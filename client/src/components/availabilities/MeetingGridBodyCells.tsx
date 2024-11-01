import React, { ReactElement, useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from 'app/hooks';
import type { PeopleDateTimes, Style } from 'common/types';
import {
  useGetCurrentMeetingWithSelector,
  useGetExternalCalendarEventsIfTokenIsPresent,
} from 'utils/meetings.hooks';
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
import { flatGridCoords } from 'utils/arrays.utils';
import { addDaysToDateString, customToISOString, roundDownDateTimeStr } from 'utils/dates.utils';
import { assert, assertIsNever } from 'utils/misc.utils';
import { selectCurrentMeetingID } from 'slices/currentMeeting';
import {
  ExternalEventInfoWithNumCols,
  calculateExternalEventInfoColumns,
  calculateTopOffsetAndHeightOfExternalEventBox,
} from './MeetingGridBodyCells.helpers';

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

function useMouseupListener(dateTimes: string[][]) {
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
    if (selMode.type === 'addingRespondent' || selMode.type === 'editingRespondent') {
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
    if (selMode.type === 'addingRespondent' || selMode.type === 'editingRespondent') {
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
}

function calculateDateTimeGrid(numRows: number, numCols: number, dateStrings: string[], startHour: number): string[][] {
  const rows: string[][] = [];
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const row: string[] = [];
    const hour = (startHour + Math.floor(rowIdx / 2)) % 24;
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
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
}

function MeetingGridBodyCells({
  numRows, numCols, startHour, dateStrings,
}: {
  numRows: number, numCols: number, startHour: number, dateStrings: string[],
}) {
  const {respondents, minStartHour, maxEndHour, scheduledStartDateTime, scheduledEndDateTime} = useGetCurrentMeetingWithSelector(
    ({data: meeting}) => ({
      respondents: meeting?.respondents,
      minStartHour: meeting?.minStartHour,
      maxEndHour: meeting?.maxEndHour,
      scheduledStartDateTime: meeting?.scheduledStartDateTime,
      scheduledEndDateTime: meeting?.scheduledEndDateTime,
    })
  );
  assert(respondents !== undefined);
  const totalPeople = Object.keys(respondents).length;
  const dateTimePeople = useMemo(() => {
    const availabilities: PeopleDateTimes = {};
    for (const [respondentID, respondent] of Object.entries(respondents)) {
      availabilities[respondentID] = respondent.availabilities;
    }
    return createDateTimePeople(availabilities);
  }, [respondents]);
  const gridCoords = useMemo(() => flatGridCoords(numRows, numCols), [numRows, numCols]);
  const dateTimes = useMemo(
    () => calculateDateTimeGrid(numRows, numCols, dateStrings, startHour),
    [numRows, numCols, dateStrings, startHour]
  );
  const meetingID = useAppSelector(selectCurrentMeetingID);
  assert(meetingID !== undefined);
  const externalEvents = useGetExternalCalendarEventsIfTokenIsPresent(meetingID);
  const dateTimesToExternalEventInfo = useMemo(
    () => {
      if (minStartHour === undefined || maxEndHour === undefined) {
        return {};
      }
      return calculateExternalEventInfoColumns(externalEvents, minStartHour, maxEndHour);
    },
    [externalEvents, minStartHour, maxEndHour]
  );
  // Use singleton to avoid re-renders
  const emptyArrayOfExternalEventInfo = useMemo(() => ({events: [], numCols: 0}), []);
  const roundedDownScheduledStartDateTime = useMemo(() => {
    return scheduledStartDateTime && roundDownDateTimeStr(scheduledStartDateTime);
  }, [scheduledStartDateTime]);
  const selMode = useAppSelector(selectSelMode);
  const hoverUser = useAppSelector(selectHoverUser);
  const somebodyIsHovered = hoverUser !== null;
  useMouseupListener(dateTimes);
  return (
    <>
      {
        gridCoords.map(([colIdx, rowIdx], i) => {
          const dateTime = dateTimes[rowIdx][colIdx];
          const scheduledStartDateTimeProp =
            roundedDownScheduledStartDateTime === dateTime
            ? scheduledStartDateTime
            : undefined;
          const externalEvents = dateTimesToExternalEventInfo[dateTime] || emptyArrayOfExternalEventInfo;
          const hoverUserIsAvailableAtThisTime = somebodyIsHovered && respondents[hoverUser].availabilities[dateTime];
          const selectedUserIsAvailableAtThisTime =
            selMode.type === 'selectedUser'
            && respondents[selMode.selectedRespondentID].availabilities[dateTime];
          const numPeopleAvailableAtThisTime = dateTimePeople[dateTime]?.length ?? 0;
          return (
            <Cell key={i} {...{
              cellIdx: i,
              rowIdx,
              colIdx,
              dateTime,
              scheduledStartDateTime: scheduledStartDateTimeProp,
              scheduledEndDateTime,
              externalEvents,
              somebodyIsHovered,
              hoverUserIsAvailableAtThisTime,
              selectedUserIsAvailableAtThisTime,
              totalPeople,
              numPeopleAvailableAtThisTime,
            }} />
          );
        })
      }
    </>
  )
}
export default React.memo(MeetingGridBodyCells);

const Cell = React.memo(function Cell({
  rowIdx,
  colIdx,
  cellIdx,
  dateTime,
  scheduledStartDateTime,
  scheduledEndDateTime,
  externalEvents,
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
  scheduledStartDateTime: string | undefined,
  scheduledEndDateTime: string | undefined,
  externalEvents: ExternalEventInfoWithNumCols,
  somebodyIsHovered: boolean,
  hoverUserIsAvailableAtThisTime: boolean,
  selectedUserIsAvailableAtThisTime: boolean,
  numPeopleAvailableAtThisTime: number,
  totalPeople: number,
}) {
  const selMode = useAppSelector(selectSelMode);
  const {selfRespondentID} = useGetCurrentMeetingWithSelector(
    ({data}) => ({selfRespondentID: data?.selfRespondentID})
  );
  const isSelected = useAppSelector(state => !!selectSelectedTimes(state)[dateTime]);
  // const {meetingIsScheduled} = useGetCurrentMeetingWithSelector(
  //   ({data: meeting}) => ({meetingIsScheduled: meeting?.scheduledDateTimes !== undefined})
  // );
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

  const style: Style = {gridArea: `c${cellIdx}`};

  let onTouchStart: React.TouchEventHandler | undefined;
  let onTouchMove: React.TouchEventHandler | undefined;
  let onTouchEnd: React.TouchEventHandler | undefined;


  let showRespondentsColour = false;
  if (selMode.type === 'addingRespondent' || selMode.type === 'editingRespondent') {
    if (
      (isInMouseSelectionArea && mouseSelectionAreaIsAddingDateTimes)
      || (!isInMouseSelectionArea && isSelected)
    ) {
      classNames.push('selected');
    }
  } else if (selMode.type === 'editingSchedule') {
    if (isInMouseSelectionColumn || isSelected) {
      classNames.push('scheduling');
    } else if (numPeopleAvailableAtThisTime > 0) {
      showRespondentsColour = true;
    }
  } else if (selMode.type === 'selectedUser') {
    if (selectedUserIsAvailableAtThisTime) {
      classNames.push('selected');
    }
  } else if (selMode.type === 'none') {
    if (somebodyIsHovered) {
      if (hoverUserIsAvailableAtThisTime) {
        classNames.push('selected');
      }
    } else if (numPeopleAvailableAtThisTime > 0) {
      showRespondentsColour = true;
    }
  } else {
    assertIsNever(selMode);
  }
  if (showRespondentsColour) {
    const rgb = 'var(--custom-primary-rgb)';
    const alpha = Math.round(100 * (0.2 + 0.8 * (numPeopleAvailableAtThisTime / totalPeople))) + '%';
    style.backgroundColor = `rgba(${rgb}, ${alpha})`;
  }

  let externalEventBoxes: ReactElement<HTMLDivElement>[] | undefined;
  if (
    (selMode.type === 'addingRespondent' || (
      selMode.type === 'editingRespondent' && selMode.respondentID === selfRespondentID
    ))
    && externalEvents.events.length > 0
  ) {
    classNames.push('position-relative', 'd-grid');
    style.gridTemplateColumns = `repeat(${externalEvents.numCols}, 1fr)`;
    externalEventBoxes = externalEvents.events.map((externalEvent, i) => {
      const {topOffset, height} = calculateTopOffsetAndHeightOfExternalEventBox(dateTime, externalEvent.startDateTime, externalEvent.endDateTime);
      return (
        <div
          key={i}
          className="weeklyview__bodycell_external_event"
          style={{
            top: Math.floor(topOffset * 100) + '%',
            height: Math.floor(height * 100) + '%',
            gridColumnStart: externalEvent.colStart,
            gridColumnEnd: externalEvent.colStart + 1,
          }}
        >
          {/* Need a nested div because changing font-size on the cell which change its height (specified in em) */}
          <div className="weeklyview__bodycell_external_event_text">{externalEvent.summary}</div>
        </div>
      );
    });
  }

  let scheduledTimeBox: ReactElement<HTMLDivElement> | undefined;
  if (
    selMode.type === 'none'
    && scheduledStartDateTime !== undefined
    && scheduledEndDateTime !== undefined
  ) {
    // re-use the same function we used for external events
    const {topOffset, height} = calculateTopOffsetAndHeightOfExternalEventBox(dateTime, scheduledStartDateTime, scheduledEndDateTime);
    scheduledTimeBox = (
      <div
        className="d-flex align-items-center weeklyview__bodycell_scheduled_inner"
        style={{
          top: Math.floor(topOffset * 100) + '%',
          height: Math.floor(height * 100) + '%',
          borderRadius: '1em'
        }}
      >
        <div className="flex-grow-1 text-center">SOVITTU AJANKOHTA</div>
      </div>
    );
  }

  const [isClick, setIsClick] = React.useState(false); // Track whether user is dragging

  let onMouseEnter: React.MouseEventHandler | undefined;
  let onMouseLeave: React.MouseEventHandler | undefined;
  let onMouseDown: React.MouseEventHandler | undefined;
  if (
    selMode.type === 'addingRespondent'
    || selMode.type === 'editingRespondent'
    || selMode.type === 'editingSchedule'
  ) {
    if (mouseStateType === 'upNoCellsSelected') {
      onTouchStart = (e) => {
        setIsClick(true);
        e.preventDefault(); // Prevents triggering mouse events on touch
        dispatch(notifyMouseDown({ cell: { rowIdx, colIdx }, wasOriginallySelected: isSelected }));
      };
      onMouseDown = () => dispatch(notifyMouseDown({ cell: { rowIdx, colIdx }, wasOriginallySelected: isSelected }));
    } else if (mouseStateType === 'down') {
      onMouseEnter = () => dispatch(notifyMouseEnter({ cell: { rowIdx, colIdx } }));
      onTouchMove = (e) => {
        e.preventDefault();
        setIsClick(false)
        const touch = e.touches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (targetElement) {
          const targetRowIdx = Number(targetElement.getAttribute('data-row-idx'));
          const targetColIdx = Number(targetElement.getAttribute('data-col-idx'));
          dispatch(notifyMouseEnter({ cell: { rowIdx: targetRowIdx, colIdx: targetColIdx } }));
        }
      };
    }
    onTouchEnd = () => {
      if (!isClick)
        dispatch(notifyMouseUp());
    };
  } else if (selMode.type === 'selectedUser') {
    onMouseDown = () => showToast({
      msg: `Klikkaa 'Muokkaa sopiva ajankohta' painiketta`,
      msgType: 'success',
      autoClose: true,
    });
  } else if (selMode.type === 'none') {
    onMouseDown = () => showToast({
      msg: "Klikkaa 'Lisää sopiva aika' painiketta",
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
      className={classNames.join(' ')}
      style={style}
      data-row-idx={rowIdx}
      data-col-idx={colIdx}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}

      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* at most one of these will be shown */}
      {scheduledTimeBox}
      {externalEventBoxes}
    </div>
  );
});
