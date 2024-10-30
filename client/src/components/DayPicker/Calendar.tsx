import React, { useState } from 'react';
import { LeftArrow as SVGLeftArrow, RightArrow as SVGRightArrow } from 'components/Arrows';
import { range } from 'utils/arrays.utils'
import {
    addDaysToDateString,
    daysOfWeekAbbr,
    getDateFromString,
    getFullMonthName,
    getNormalYearMonthDayFromDate,

} from 'utils/dates.utils';
import CalendarCell from './CalendarCell';

export default function Calendar({firstVisibleDate}: {firstVisibleDate: string}) {
  const [page, setPage] = useState(0);
  const firstSelectedDate_dayOfWeek = getDateFromString(firstVisibleDate).getDay();
  const firstDateInGridForPage0 = addDaysToDateString(firstVisibleDate, -firstSelectedDate_dayOfWeek);
  const firstDateInGrid = addDaysToDateString(firstDateInGridForPage0, 35 * page);

  const monthCells = range(35).map((cellIdx) => (
    <CalendarCell
      key={cellIdx}
      firstVisibleDate={firstVisibleDate}
      firstDateInGrid={firstDateInGrid}
      cellIdx={cellIdx}
    />
  ));

  const leftArrow = (
    <div className="d-flex align-items-center ms-0 ms-md-3">
      <SVGLeftArrow
        className={page > 0 ? 'visible' : 'invisible'}
        onClick={() => setPage(page - 1)}
      />
    </div>
  );
  const rightArrow = (
    <div className="d-flex align-items-center ms-0 ms-md-3">
      <SVGRightArrow onClick={() => setPage(page + 1)}/>
    </div>
  );

  return (
      <>
          <CalendarMonthTextCell date={firstDateInGrid}/>
          <div style={{display: 'flex', flexFlow: 'row nowrap'}}>
              {leftArrow}
              <div className="daypicker-calendar">
                  <DayOfWeekRow/>
                  {monthCells}
              </div>
              {rightArrow}
          </div>
      </>
  );
};

const CalendarMonthTextCell = React.memo(function CalendarMonthTextCell(
    {date}: { date: string }
) {
    const middleOfMonth = addDaysToDateString(date, 10);
    const [tableYear, monthNum] = getNormalYearMonthDayFromDate(new Date(middleOfMonth));
    const [currentYear] = getNormalYearMonthDayFromDate(new Date());
    const monthName = `${getFullMonthName(monthNum, true)}`;
    const dateText = tableYear === currentYear
        ? monthName
        : `${monthName} ${tableYear}`;
    return <div className="weeklyview-grid__monthtext">{dateText}</div>;
});

const DayOfWeekRow = React.memo(function DayOfWeekRow() {
  return (
    <>
      {daysOfWeekAbbr.map(day => (
        <div key={day} className="daypicker-dayofweek-cell">
          {day}
        </div>
      ))}
    </>
  );
});
