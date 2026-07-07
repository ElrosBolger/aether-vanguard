import type { InputPacket } from '@shared/movementSimulation';

export class InputQueue {
  private pendingInputs: InputPacket[] = [];

  push(input: InputPacket): void {
    this.pendingInputs.push(input);
  }

  /**
   * Removes all inputs with seq <= ackSeq (already processed by server) and
   * returns the remaining ones in original order, ready for replay.
   */
  acknowledge(ackSeq: number): InputPacket[] {
    this.pendingInputs = this.pendingInputs.filter((input) => input.seq > ackSeq);
    return [...this.pendingInputs];
  }

  get size(): number {
    return this.pendingInputs.length;
  }

  clear(): void {
    this.pendingInputs = [];
  }
}
