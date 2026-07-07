import { InputQueue } from './InputQueue';
import {
  FIXED_DT,
  simulateStep,
  type InputPacket,
  type StaticObstacle,
  type Vec2,
} from '@shared/movementSimulation';

export interface ServerSnapshot {
  lastProcessedInputSeq: number;
  x: number;
  y: number;
}

type SendInputFn = (input: InputPacket) => void;
type GetInputVectorFn = () => { moveX: number; moveY: number };

const RENDER_SMOOTHING = 12;
const RECONCILIATION_ERROR_THRESHOLD = 0.02;

export class PredictionController {
  private simState: Vec2;
  private renderState: Vec2;
  private inputQueue = new InputQueue();
  private nextSeq = 0;
  private accumulator = 0;

  constructor(
    initialPosition: Vec2,
    private obstacles: StaticObstacle[],
    private getInputVector: GetInputVectorFn,
    private sendInput: SendInputFn
  ) {
    this.simState = { ...initialPosition };
    this.renderState = { ...initialPosition };
  }

  /**
   * Call every frame (requestAnimationFrame) with the real delta in seconds.
   * Uses a fixed-step accumulator so each simulation step is identical
   * regardless of device framerate.
   */
  update(deltaSeconds: number): void {
    this.accumulator += deltaSeconds;

    while (this.accumulator >= FIXED_DT) {
      this.tick();
      this.accumulator -= FIXED_DT;
    }

    this.smoothRender(deltaSeconds);
  }

  private tick(): void {
    const { moveX, moveY } = this.getInputVector();

    if (moveX === 0 && moveY === 0) return;

    const input: InputPacket = { seq: this.nextSeq++, moveX, moveY };

    this.simState = simulateStep(this.simState, input, this.obstacles);

    this.inputQueue.push(input);
    this.sendInput(input);
  }

  /**
   * Call when a ServerSnapshot arrives for the local player, hooked from
   * GameNetworkClient via player.onChange on the Colyseus state.
   */
  onServerSnapshot(snapshot: ServerSnapshot): void {
    const unacked = this.inputQueue.acknowledge(snapshot.lastProcessedInputSeq);

    const errorX = Math.abs(this.simState.x - snapshot.x);
    const errorY = Math.abs(this.simState.y - snapshot.y);

    if (errorX < RECONCILIATION_ERROR_THRESHOLD && errorY < RECONCILIATION_ERROR_THRESHOLD) {
      return;
    }

    let correctedState: Vec2 = { x: snapshot.x, y: snapshot.y };
    for (const input of unacked) {
      correctedState = simulateStep(correctedState, input, this.obstacles);
    }

    this.simState = correctedState;
    // renderState moves toward simState smoothly via smoothRender() — no pop.
  }

  private smoothRender(deltaSeconds: number): void {
    const t = 1 - Math.exp(-RENDER_SMOOTHING * deltaSeconds);
    this.renderState.x += (this.simState.x - this.renderState.x) * t;
    this.renderState.y += (this.simState.y - this.renderState.y) * t;
  }

  getRenderPosition(): Vec2 {
    return { ...this.renderState };
  }
}
