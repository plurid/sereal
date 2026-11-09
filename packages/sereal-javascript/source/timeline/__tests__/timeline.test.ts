// #region imports
import { describe, expect, it } from 'vitest';
import { createSereal, fromSereal, serealType, toSereal } from '../../index.ts';
import { createTimeline } from '../index.ts';
// #endregion imports

// #region module
describe('Timeline', () => {
    class Counter {
        static readonly [serealType] = { name: 'app.Counter' };
        count: number;
        constructor(count: number) {
            this.count = count;
        }
        [toSereal]() {
            return { count: this.count };
        }
        static [fromSereal](data: { count: number }) {
            return new Counter(data.count);
        }
    }

    const sereal = createSereal({ types: [Counter] });

    it('tracks history with commit, undo, and redo', () => {
        const timeline = createTimeline<Counter>(sereal, {
            initial: new Counter(0),
        });

        expect(timeline.present?.count).toBe(0);
        expect(timeline.canUndo).toBe(false);
        expect(timeline.canRedo).toBe(false);

        timeline.commit(new Counter(1));
        timeline.commit(new Counter(2));

        expect(timeline.present?.count).toBe(2);
        expect(timeline.canUndo).toBe(true);
        expect(timeline.canRedo).toBe(false);
        expect(timeline.size).toEqual({ past: 2, future: 0 });

        expect(timeline.undo()).toBe(true);
        expect(timeline.present?.count).toBe(1);
        expect(timeline.canUndo).toBe(true);
        expect(timeline.canRedo).toBe(true);

        expect(timeline.undo()).toBe(true);
        expect(timeline.present?.count).toBe(0);
        expect(timeline.canUndo).toBe(false);
        expect(timeline.canRedo).toBe(true);

        expect(timeline.undo()).toBe(false);

        expect(timeline.redo()).toBe(true);
        expect(timeline.present?.count).toBe(1);

        // Committing clears future redo stack
        timeline.commit(new Counter(99));
        expect(timeline.present?.count).toBe(99);
        expect(timeline.canRedo).toBe(false);
    });

    it('stores snapshots immutably so mutating live objects does not alter history', () => {
        const initial = { list: [1, 2] };
        const timeline = createTimeline(sereal, { initial });

        initial.list.push(3); // live mutation
        timeline.commit(initial);

        initial.list.push(4); // another live mutation

        timeline.undo();
        expect(timeline.present).toEqual({ list: [1, 2] });
    });

    it('enforces limit on history stack', () => {
        const timeline = createTimeline<number>(sereal, {
            initial: 0,
            limit: 2,
        });

        timeline.commit(1);
        timeline.commit(2);
        timeline.commit(3);

        expect(timeline.size.past).toBe(2);
        timeline.undo(); // 2
        timeline.undo(); // 1
        expect(timeline.canUndo).toBe(false); // 0 was trimmed
    });

    it('exports toJSON and restores from snapshot', () => {
        const timeline = createTimeline<number>(sereal, { initial: 1 });
        timeline.commit(2);
        timeline.commit(3);
        timeline.undo();

        const json = timeline.toJSON();
        const restored = createTimeline<number>(sereal, { from: json });

        expect(restored.present).toBe(2);
        expect(restored.canUndo).toBe(true);
        expect(restored.canRedo).toBe(true);

        restored.redo();
        expect(restored.present).toBe(3);
    });

    it('supports subscriber notifications on change', () => {
        const timeline = createTimeline<number>(sereal, { initial: 10 });
        const received: (number | undefined)[] = [];

        const unsubscribe = timeline.subscribe((present) => {
            received.push(present);
        });

        timeline.commit(20);
        timeline.undo();
        timeline.redo();
        unsubscribe();
        timeline.commit(30);

        expect(received).toEqual([20, 10, 20]);
    });

    it('clear() empties past and future but retains present', () => {
        const timeline = createTimeline<number>(sereal, { initial: 1 });
        timeline.commit(2);
        timeline.clear();

        expect(timeline.present).toBe(2);
        expect(timeline.canUndo).toBe(false);
        expect(timeline.canRedo).toBe(false);
        expect(timeline.size).toEqual({ past: 0, future: 0 });
    });
});
// #endregion module
