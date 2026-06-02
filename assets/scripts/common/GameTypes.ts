export enum GameState {
    IDLE = 'IDLE',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    RESULT = 'RESULT',
}

export interface IGameInfo {
    gameId: number;
    title: string;
    description: string;
    introduction: string;
}

