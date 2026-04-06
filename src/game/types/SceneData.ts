export interface ShiftSceneData {
  day: number;
  money: number;
  accuracy: number;
  gameOver?: boolean;
}

export const INITIAL_SHIFT_STATE: ShiftSceneData = {
  day: 1,
  money: 100,
  accuracy: 100,
};
