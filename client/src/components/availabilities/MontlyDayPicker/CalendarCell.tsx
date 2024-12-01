import React, {CSSProperties} from 'react';
import {
  addDaysToDateString,
  getMonthAbbr,
  getYearMonthDayFromDateString,
} from 'utils/dates.utils';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import {addDate, removeDate, resetSelectedDates, selectSelectedDates} from 'slices/selectedDates';
import {selectSelMode, setHoverDateTime} from "../../../slices/availabilitiesSelection";

type CalendarCellProps = {
  firstVisibleDate: string; // YYYY-MM-DD
  firstDateInGrid: string;  // YYYY-MM-DD
  cellIdx: number;
  enabled: boolean;
  allowEdit: boolean;
  highlighted: boolean;
  showRepondents: boolean;
  availablePeople: number;
  scheduledDate: boolean;
  totalPeople: number;
  singleDateAllowed: boolean;
};

function CalendarCell({firstVisibleDate, firstDateInGrid, cellIdx, enabled, allowEdit, highlighted, showRepondents, availablePeople, totalPeople, singleDateAllowed, scheduledDate}: CalendarCellProps) {
  const dateString = addDaysToDateString(firstDateInGrid, cellIdx+1);
  const [, month, day] = getYearMonthDayFromDateString(dateString);
  const isEmpty = dateString < firstVisibleDate;
  const isSelected = useAppSelector(state => !!selectSelectedDates(state)[dateString]);
  const dispatch = useAppDispatch();

  const onClick = () => {
    if (isEmpty) {
      return;
    }
    if (isSelected) {
      dispatch(removeDate(dateString));
    } else {
      if (singleDateAllowed)
        dispatch(resetSelectedDates())
      dispatch(addDate(dateString));
    }
  };

  let style: CSSProperties = {};
  if (showRepondents && enabled && !isSelected) {
    const rgb = 'var(--custom-primary-rgb)';
    const alpha = Math.round(100 * ( 0.8 * (availablePeople / totalPeople)));
    style.backgroundColor = `rgba(${rgb}, ${alpha + '%'})`;
    if (alpha > 0 && allowEdit)
      style.color = 'unset';
  }

  if (scheduledDate) {
    style.backgroundColor = 'var(--custom-danger-strong)'
    style.color = 'var(--custom-danger-contrast)'
  }

  let onMouseEnter;
  let onMouseLeave;

  if (showRepondents) {
    onMouseEnter = () => dispatch(setHoverDateTime(dateString));
    onMouseLeave = () => dispatch(setHoverDateTime(null));
  }

  return (
    <div className="event-daypicker-calendar__cell">
      {!isEmpty && (
        <>
          {
            (dateString === firstVisibleDate || dateString === firstDateInGrid || day === 1) ? (
              <div className="event-daypicker-calendar-cell-month-indicator">
                {getMonthAbbr(month-1)}
              </div>
            ) : (
              <div style={{height: '1em'}}></div>
            )
          }
          <div
            className={"event-daypicker-calendar__cell__" + ((allowEdit) ? "button " : "preview ") + (
                enabled ? ((isSelected || highlighted) ? "selected" : " unselected") : "disabled"
            )}
            onMouseLeave={onMouseLeave} onMouseEnter={onMouseEnter}
            onClick={(enabled && allowEdit) ? onClick : undefined}
            style={style}
          >
            {day}
          </div>
        </>
      )}
    </div>
  );
};
export default React.memo(CalendarCell);
