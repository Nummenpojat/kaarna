import React, { useState } from 'react';
import { LeftArrow as SVGLeftArrow, RightArrow as SVGRightArrow } from 'components/Arrows';
import { range } from 'utils/arrays.utils'
import {
    addDaysToDateString,
    daysOfWeekAbbr,
    getDateFromString,
    getFullMonthName,
    getNormalYearMonthDayFromDate, getWeekNumberFromDate,

} from 'utils/dates.utils';
import CalendarCell from './CalendarCell';
import {toggleDates} from "../../slices/selectedDates";
import {useAppDispatch} from "../../app/hooks";

export default function Calendar({firstVisibleDate}: {firstVisibleDate: string}) {
  const [page, setPage] = useState(0);
  const firstSelectedDate_dayOfWeek = getDateFromString(firstVisibleDate).getUTCDay();
  const firstDateInGridForPage0 = addDaysToDateString(firstVisibleDate, -firstSelectedDate_dayOfWeek);
  const firstDateInGrid = addDaysToDateString(firstDateInGridForPage0, 35 * page);

  const monthCells = range(40).map((cellIdx) => {
      const startOfRowDate = addDaysToDateString(firstDateInGrid, cellIdx+1);
      const weekNumber = getWeekNumberFromDate(new Date(startOfRowDate)); // Calculate the week number
      const adjustedCellIdx = Math.floor(cellIdx - Math.floor(cellIdx / 8));
      return (cellIdx % 8 === 0 ?
              <div key={cellIdx} className="week-number-row">
                  <div style={{height: "1em"}}></div>
                  <div className={"week-number-item"}>
                      {weekNumber}
                  </div>
              </div> :
              <CalendarCell
                  key={cellIdx}
                  firstVisibleDate={firstVisibleDate}
                  firstDateInGrid={firstDateInGrid}
                  cellIdx={adjustedCellIdx-2}
              />
      )
  });

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

    // Render week numbers
    const weekNumbers = range(5).map((rowIdx) => {
        const startOfRowDate = addDaysToDateString(firstDateInGrid, rowIdx * 7);
        const weekNumber = getWeekNumberFromDate(new Date(startOfRowDate)); // Calculate the week number
        return (
            <div key={rowIdx} className="week-number-row">
                {weekNumber}
            </div>
        );
    });

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
    const dispatch = useAppDispatch();
    const monthName = `${getFullMonthName(monthNum, true)}`;
    const dateText = tableYear === currentYear
        ? monthName
        : `${monthName} ${tableYear}`;


    // Function to toggle all days in the month
    const toggleWholeMonth = () => {
        console.log("clic", monthNum)
        const lastDayOfMonth = new Date(tableYear, monthNum+1, 0);
        console.log(lastDayOfMonth)

        const daysInMonth: string[] = [];
        for (let day = 2; day <= lastDayOfMonth.getDate()+1; day++) {
            daysInMonth.push(new Date(tableYear, monthNum, day).toISOString().split('T')[0]);
        }
        console.log(daysInMonth);

        // Dispatch an action to toggle the dates
        dispatch(toggleDates(daysInMonth));
    };

    return <div className="weeklyview-grid__monthtext" onClick={toggleWholeMonth}>{dateText}</div>;
});

const DayOfWeekRow = React.memo(function DayOfWeekRow() {
    return (
        <>
            <div key={""} className="daypicker-dayofweek-cell">
            </div>
            {daysOfWeekAbbr.map(day => (
                <div key={day} className="daypicker-dayofweek-cell">
                    {day}
                </div>
            ))}
        </>
    );
});
