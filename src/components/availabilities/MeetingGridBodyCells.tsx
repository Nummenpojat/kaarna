import React, { useMemo } from 'react';
import { useAppSelector, useAppDispatch } from 'app/hooks';
import type { PeopleDateTimes, Style } from 'common/types';
import {
  selectSelMode,
  selectSelectedTimes,
  selectHoverUser,
  setHoverDateTime,
  addDateTimesAndResetMouse,
  removeDateTimesAndResetMouse,
  selectMouseState,
  notifyMouseUp,
  notifyMouseDown,
  notifyMouseEnter,
} from 'slices/availabilitiesSelection';
import type { MouseState } from 'slices/availabilitiesSelection';
import { useToast } from 'components/Toast';
import { flatGridCoords } from 'utils/arrays';
import { addDaysToDateString, customToISOString } from 'utils/dates';
import { assertIsNever } from 'utils/misc';
import { useEffect } from 'react';
import { selectScheduledDateTimes } from 'slices/meetingTimes';

// TODO: deal with decimal start/end times

type DateTimePeople = {
  [dateTime: string]: string[];
};

function createDateTimePeople(availabilities: PeopleDateTimes): DateTimePeople {
  const result: DateTimePeople = {};
    for (const [person, dateTimes] of Object.entries(availabilities)) {
      for (const dateTime of Object.keys(dateTimes)) {
        if (!result.hasOwnProperty(dateTime)) {
          result[dateTime] = [];
        }
        result[dateTime].push(person);
      }
    }
    return result;
}

function cellIsInSelectionArea(
  rowIdx: number,
  colIdx: number,
  state: MouseState,
): boolean {
  return (state.type === 'down' || state.type === 'upCellsSelected') && (
    (
      (state.downCell.rowIdx <= rowIdx && rowIdx <= state.curCell.rowIdx)
      || (state.curCell.rowIdx <= rowIdx && rowIdx <= state.downCell.rowIdx)
    ) && (
      (state.downCell.colIdx <= colIdx && colIdx <= state.curCell.colIdx)
      || (state.curCell.colIdx <= colIdx && colIdx <= state.downCell.colIdx)
    )
  );
}

function cellIsInSelectionColumn(
  rowIdx: number,
  colIdx: number,
  state: MouseState,
): boolean {
  return (state.type === 'down' || state.type === 'upCellsSelected') && (
    (
      (state.downCell.rowIdx <= rowIdx && rowIdx <= state.curCell.rowIdx)
      || (state.curCell.rowIdx <= rowIdx && rowIdx <= state.downCell.rowIdx)
    ) && (
      state.downCell.colIdx === colIdx
    )
  );
}

function MouseupProvider({
  children,
  dateTimes,
}: React.PropsWithChildren<{
  dateTimes: string[][],
}>) {
  const dispatch = useAppDispatch();
  const selMode = useAppSelector(selectSelMode);
  const mouseState = useAppSelector(selectMouseState);

  // The mouseup listener needs to be attached to the whole document
  // because we need to dispatch the 'up' action no matter where the
  // event occurs
  useEffect(() => {
    const listener = () => dispatch(notifyMouseUp());
    document.addEventListener('mouseup', listener);
    return () => document.removeEventListener('mouseup', listener);
  }, [dispatch]);

  useEffect(() => {
    if (mouseState?.type !== 'upCellsSelected') {
      return;
    }
    const dateTimesInSelectionArea: string[] = [];
    let rowStart = mouseState.downCell.rowIdx;
    let rowEnd = mouseState.curCell.rowIdx;
    if (rowStart > rowEnd) {
      [rowStart, rowEnd] = [rowEnd, rowStart];
    }
    let colStart = mouseState.downCell.colIdx;
    let colEnd = mouseState.curCell.colIdx;
    if (selMode.type === 'editingSelf' || selMode.type === 'editingOther') {
      if (colStart > colEnd) {
        [colStart, colEnd] = [colEnd, colStart];
      }
    } else if (selMode.type === 'editingSchedule') {
      // Scheduled cells must be in the same column because they must be
      // chronologically contiguous
      colEnd = colStart;
    }
    for (let rowIdx = rowStart; rowIdx <= rowEnd; rowIdx++) {
      for (let colIdx = colStart; colIdx <= colEnd; colIdx++) {
        dateTimesInSelectionArea.push(dateTimes[rowIdx][colIdx]);
      }
    }
    if (selMode.type === 'editingSelf' || selMode.type === 'editingOther') {
      if (mouseState.downCellWasOriginallySelected) {
        dispatch(removeDateTimesAndResetMouse(dateTimesInSelectionArea));
      } else {
        dispatch(addDateTimesAndResetMouse(dateTimesInSelectionArea));
      }
    } else if (selMode.type === 'editingSchedule') {
      // When scheduling, each new selection erases the old one because
      // scheduled cells cannot be disjoint
      dispatch(addDateTimesAndResetMouse(dateTimesInSelectionArea));
    }
  }, [mouseState, selMode.type, dispatch, dateTimes]);

  return <>{children}</>;
}

function MeetingGridBodyCells({
  numRows, numCols, startHour, dateStrings,
}: {
  numRows: number, numCols: number, startHour: number, dateStrings: string[],
}) {
  const availabilities = useAppSelector(state => state.meetingTimes.availabilities);
  const totalPeople = Object.keys(availabilities).length;
  const dateTimePeople = useMemo(() => createDateTimePeople(availabilities), [availabilities]);
  const gridCoords = useMemo(() => flatGridCoords(numRows, numCols), [numRows, numCols]);
  const dateTimes = useMemo((): string[][] => {
    const rows: string[][] = [];
    for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
      const row: string[] = [];
      for (let colIdx = 0; colIdx < numCols; colIdx++) {
        const hour = (startHour + Math.floor(rowIdx / 2)) % 24;
        let date = dateStrings[colIdx];
        if (hour < startHour) {
          // This can happen if [startTime, endTime) spans midnight, e.g.
          // 10 P.M. to 2 A.M.
          date = addDaysToDateString(date, 1);
        }
        const dateTime = customToISOString(
          date,
          hour,
          rowIdx % 2 === 0 ? 0 : 30
        );
        row.push(dateTime);
      }
      rows.push(row);
    }
    return rows;
  }, [numRows, numCols, dateStrings, startHour]);
  const scheduleSet = useAppSelector(selectScheduledDateTimes);
  const selMode = useAppSelector(selectSelMode);
  const hoverUser = useAppSelector(selectHoverUser);
  const somebodyIsHovered = hoverUser !== null;

  return (
    <MouseupProvider dateTimes={dateTimes}>
      {
        gridCoords.map(([colIdx, rowIdx], i) => {
          const dateTime = dateTimes[rowIdx][colIdx];
          const isScheduled = scheduleSet[dateTime];
          const hoverUserIsAvailableAtThisTime = somebodyIsHovered && availabilities[hoverUser][dateTime];
          const selectedUserIsAvailableAtThisTime = selMode.type === 'selectedOther' && availabilities[selMode.otherUserID][dateTime];
          const numPeopleAvailableAtThisTime = dateTimePeople[dateTime]?.length ?? 0;
          return (
            <Cell key={i} {...{
              cellIdx: i,
              rowIdx,
              colIdx,
              dateTime,
              isScheduled,
              somebodyIsHovered,
              hoverUserIsAvailableAtThisTime,
              selectedUserIsAvailableAtThisTime,
              totalPeople,
              numPeopleAvailableAtThisTime,
            }} />
          );
        })
      }
    </MouseupProvider>
  )
}
export default React.memo(MeetingGridBodyCells);

const Cell = React.memo(function Cell({
  rowIdx,
  colIdx,
  cellIdx,
  dateTime,
  isScheduled,
  somebodyIsHovered,
  hoverUserIsAvailableAtThisTime,
  selectedUserIsAvailableAtThisTime,
  numPeopleAvailableAtThisTime,
  totalPeople,
}: {
  rowIdx: number,
  colIdx: number,
  cellIdx: number,
  dateTime: string,
  isScheduled: boolean,
  somebodyIsHovered: boolean,
  hoverUserIsAvailableAtThisTime: boolean,
  selectedUserIsAvailableAtThisTime: boolean,
  numPeopleAvailableAtThisTime: number,
  totalPeople: number,
}) {
  const selMode = useAppSelector(selectSelMode);
  const isSelected = useAppSelector(state => !!selectSelectedTimes(state)[dateTime]);
  const mouseStateType = useAppSelector((state) => selectMouseState(state)?.type);
  const isInMouseSelectionArea = useAppSelector((state) => {
    const mouseState = selectMouseState(state);
    return mouseState !== null && cellIsInSelectionArea(rowIdx, colIdx, mouseState);
  });
  const isInMouseSelectionColumn = useAppSelector((state) => {
    const mouseState = selectMouseState(state);
    return mouseState !== null && cellIsInSelectionColumn(rowIdx, colIdx, mouseState);
  });
  const mouseSelectionAreaIsAddingDateTimes = useAppSelector((state) => {
    const mouseState = selectMouseState(state);
    return (
      mouseState !== null
      && (mouseState.type === 'down' || mouseState.type === 'upCellsSelected')
      && !mouseState.downCellWasOriginallySelected
    );
  });
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  const classNames = ['weeklyview__bodycell'];
  if (rowIdx === 0) classNames.push('weeklyview__bodycell_firstrow');
  if (colIdx === 0) classNames.push('weeklyview__bodycell_firstcol');
  if (rowIdx % 2 === 1) classNames.push('weeklyview__bodycell_oddrow');
  const className = classNames.join(' ');

  const style: Style = {gridArea: `c${cellIdx}`};
  let rgb: string | undefined;
  let alpha = '100%';
  if (
    selMode.type === 'editingSelf'
    || selMode.type === 'submittingSelf'
    || selMode.type === 'submittedSelf'
    || selMode.type === 'rejectedSelf'
  ) {
    if (
      (isInMouseSelectionArea && mouseSelectionAreaIsAddingDateTimes)
      || (!isInMouseSelectionArea && isSelected)
    ) {
      rgb = 'var(--custom-primary-rgb)';
    }
  } else if (
    selMode.type === 'editingSchedule'
    || selMode.type === 'submittingSchedule'
    || selMode.type === 'submittedSchedule'
    || selMode.type === 'rejectedSchedule'
  ) {
    if (isInMouseSelectionColumn || isSelected) {
      rgb = 'var(--custom-scheduled-cell-rgb)';
    } else if (numPeopleAvailableAtThisTime > 0) {
      rgb = 'var(--custom-primary-rgb)';
      alpha = Math.round(100 * (0.2 + 0.8 * (numPeopleAvailableAtThisTime / totalPeople))) + '%';
    }
  } else if (selMode.type === 'selectedOther') {
    if (selectedUserIsAvailableAtThisTime) {
      rgb = 'var(--custom-primary-rgb)';
    }
  } else if (
    selMode.type === 'editingOther'
    || selMode.type === 'submittingOther'
    || selMode.type === 'submittedOther'
    || selMode.type === 'rejectedOther'
  ) {
    if (
      (isInMouseSelectionArea && mouseSelectionAreaIsAddingDateTimes)
      || (!isInMouseSelectionArea && isSelected)
    ) {
      rgb = 'var(--custom-primary-rgb)';
    }
  } else if (
    selMode.type === 'none'
    || selMode.type === 'submittingUnschedule'
    || selMode.type === 'submittedUnschedule'
    || selMode.type === 'rejectedUnschedule'
  ) {
    if (somebodyIsHovered) {
      if (hoverUserIsAvailableAtThisTime) {
        rgb = 'var(--custom-primary-rgb)';
      }
    } else if (numPeopleAvailableAtThisTime > 0) {
      rgb = 'var(--custom-primary-rgb)';
      alpha = Math.round(100 * (0.2 + 0.8 * (numPeopleAvailableAtThisTime / totalPeople))) + '%';
    }
    if (isScheduled) {
      // TODO: only partially cover the cell
      rgb = 'var(--custom-scheduled-cell-rgb)';
    }
  } else {
    assertIsNever(selMode);
  }

  if (rgb !== undefined) {
    style.backgroundColor = `rgba(${rgb}, ${alpha})`;
  }
  let onMouseEnter: React.MouseEventHandler | undefined;
  let onMouseLeave: React.MouseEventHandler | undefined;
  let onMouseDown: React.MouseEventHandler | undefined;
  if (selMode.type === 'editingSelf' || selMode.type === 'editingOther' || selMode.type === 'editingSchedule') {
    if (mouseStateType === 'upNoCellsSelected') {
      onMouseDown = () => dispatch(notifyMouseDown({cell: {rowIdx, colIdx}, wasOriginallySelected: isSelected}));
    } else if (mouseStateType === 'down') {
      onMouseEnter = () => dispatch(notifyMouseEnter({cell: {rowIdx, colIdx}}));
    }
  } else if (selMode.type === 'selectedOther') {
    onMouseDown = () => showToast({
      msg: `Click the 'Edit availability' button`,
      msgType: 'success',
      autoClose: true,
    });
  } else if (selMode.type === 'none') {
    onMouseDown = () => showToast({
      msg: "Click the 'Add availability' button",
      msgType: 'success',
      autoClose: true,
    });
    onMouseEnter = () => dispatch(setHoverDateTime(dateTime));
    // TODO: it's inefficient to have onMouseLeave on each cell - maybe we can
    // create a parent component around the Cell components and place it there?
    onMouseLeave = () => dispatch(setHoverDateTime(null));
  }
  return (
    <div
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
    </div>
  );
});
