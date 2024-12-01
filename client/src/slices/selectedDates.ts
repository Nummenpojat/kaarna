import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from 'app/store';
import type { DateSet } from 'common/types';

export type SelectedDatesType = {
  // These are the dates which the user has selected from the calendar
  // e.g. { '2022-08-27': true, '2022-08-28': true }
  dates: DateSet;
};

const initialState: SelectedDatesType = {
  dates: {},
};

export const selectedDatesSlice = createSlice({
  name: 'selectedDates',
  initialState,
  reducers: {
    addDate: (state, action: PayloadAction<string>) => {
      const dateString = action.payload;
      state.dates[dateString] = true;
    },
    toggleDates: (state, action: PayloadAction<string[]>) => {
      for (let i of action.payload) {
        if (state.dates[i]) {
          delete state.dates[i]
        } else {
          state.dates[i] = true;
        }
      }
    },
    removeDate: (state, action: PayloadAction<string>) => {
      const dateString = action.payload;
      delete state.dates[dateString];
    },
    setDates: (state, action: PayloadAction<DateSet>) => {
      state.dates = action.payload;
    },
    reset: (state) => {
      return initialState;
    },
  }
});

export const {
  addDate,
  removeDate,
  setDates: setSelectedDates,
  reset: resetSelectedDates,
  toggleDates
} = selectedDatesSlice.actions;

export const selectSelectedDates = (state: RootState) => state.selectedDates.dates;

export default selectedDatesSlice.reducer;
