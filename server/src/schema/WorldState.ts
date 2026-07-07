import { Schema, MapSchema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') playerId: string = '';
  @type('string') username: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') lastProcessedInputSeq: number = 0;
}

export class WorldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
