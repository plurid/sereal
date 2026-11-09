// #region imports
import { SerealError } from '../errors.ts';
import type { Sereal, SerealDocument } from '../types.ts';
// #endregion imports

// #region module
/**
 * A persistable timeline state: every snapshot is a sereal document.
 */
export interface TimelineSnapshot {
    readonly past: readonly SerealDocument[];
    readonly present: SerealDocument | null;
    readonly future: readonly SerealDocument[];
}

export interface TimelineOptions<T> {
    /** Initial present value. Ignored when `from` is given. */
    readonly initial?: T;
    /** Restore a previously exported timeline (`timeline.toJSON()`). */
    readonly from?: TimelineSnapshot;
    /** Maximum number of past snapshots to keep. Defaults to `100`. */
    readonly limit?: number;
}

export type TimelineListener<T> = (present: T | undefined) => void;

export interface Timeline<T> {
    /** The current value, decoded from its snapshot (cached until the present changes). */
    readonly present: T | undefined;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /** Number of snapshots before / after the present. */
    readonly size: { readonly past: number; readonly future: number };
    /** Records a new present. Clears the redo stack. */
    commit(state: T): void;
    /** Moves one step back. Returns `false` if there is nothing to undo. */
    undo(): boolean;
    /** Moves one step forward. Returns `false` if there is nothing to redo. */
    redo(): boolean;
    /** Drops past and future snapshots, keeping the present. */
    clear(): void;
    /** Exports the timeline as JSON-safe snapshots. */
    toJSON(): TimelineSnapshot;
    /** Subscribes to present changes. Returns an unsubscribe function. */
    subscribe(listener: TimelineListener<T>): () => void;
}

const DEFAULT_LIMIT = 100;

const restore = (snapshot: TimelineSnapshot): [string[], string | null, string[]] => {
    const valid =
        typeof snapshot === 'object' &&
        snapshot !== null &&
        Array.isArray(snapshot.past) &&
        Array.isArray(snapshot.future) &&
        (snapshot.present === null || typeof snapshot.present === 'object');
    if (!valid) {
        throw new SerealError(
            'INVALID_DOCUMENT',
            'Timeline snapshot must be { past: [], present, future: [] }.',
        );
    }
    const text = (document: SerealDocument): string => JSON.stringify(document);
    return [
        snapshot.past.map(text),
        snapshot.present === null ? null : text(snapshot.present),
        snapshot.future.map(text),
    ];
};

/**
 * Creates an undo/redo timeline whose snapshots are sereal documents.
 *
 * Snapshots are stored encoded, so they never alias live objects: mutating a
 * value after `commit()` cannot rewrite history.
 *
 * @example
 * const timeline = createTimeline(sereal, { initial: state });
 * timeline.commit(nextState);
 * timeline.undo();
 * localStorage.setItem('history', JSON.stringify(timeline));
 */
export const createTimeline = <T = unknown>(
    sereal: Sereal,
    options: TimelineOptions<T> = {},
): Timeline<T> => {
    const limit = options.limit ?? DEFAULT_LIMIT;
    if (!(Number.isSafeInteger(limit) && limit >= 0) && limit !== Number.POSITIVE_INFINITY) {
        throw new RangeError(
            `sereal: timeline limit must be a non-negative integer, got ${limit}.`,
        );
    }

    let past: string[] = [];
    let present: string | null = null;
    let future: string[] = [];

    if (options.from) {
        [past, present, future] = restore(options.from);
        // Validate eagerly so a corrupt snapshot fails at restore time.
        for (const text of [...past, ...future, ...(present === null ? [] : [present])]) {
            sereal.parse(text);
        }
    } else if (Object.hasOwn(options, 'initial')) {
        present = sereal.stringify(options.initial);
    }

    const listeners = new Set<TimelineListener<T>>();
    let cache: { readonly value: T | undefined } | undefined;

    const current = (): T | undefined => {
        if (!cache) {
            cache = { value: present === null ? undefined : sereal.parse<T>(present) };
        }
        return cache.value;
    };

    const changed = (): void => {
        cache = undefined;
        if (listeners.size === 0) {
            return;
        }
        const value = current();
        for (const listener of [...listeners]) {
            listener(value);
        }
    };

    const trim = (): void => {
        if (past.length > limit) {
            past = past.slice(past.length - limit);
        }
    };

    return {
        get present() {
            return current();
        },
        get canUndo() {
            return past.length > 0;
        },
        get canRedo() {
            return future.length > 0;
        },
        get size() {
            return { past: past.length, future: future.length };
        },
        commit(state) {
            const next = sereal.stringify(state);
            if (present !== null) {
                past.push(present);
                trim();
            }
            present = next;
            future = [];
            changed();
        },
        undo() {
            const previous = past.pop();
            if (previous === undefined) {
                return false;
            }
            if (present !== null) {
                future.push(present);
            }
            present = previous;
            changed();
            return true;
        },
        redo() {
            const next = future.pop();
            if (next === undefined) {
                return false;
            }
            if (present !== null) {
                past.push(present);
                trim();
            }
            present = next;
            changed();
            return true;
        },
        clear() {
            past = [];
            future = [];
        },
        toJSON() {
            const parse = (text: string): SerealDocument => JSON.parse(text) as SerealDocument;
            return {
                past: past.map(parse),
                present: present === null ? null : parse(present),
                future: future.map(parse),
            };
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
};
// #endregion module
