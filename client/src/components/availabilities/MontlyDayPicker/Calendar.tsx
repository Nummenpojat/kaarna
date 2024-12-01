import React, {useMemo, useState} from 'react';
import { LeftArrow as SVGLeftArrow, RightArrow as SVGRightArrow } from 'components/Arrows';
import { range } from 'utils/arrays.utils'
import './DayPicker.css'
import {
    addDaysToDateString,
    daysOfWeekAbbr,
    getDateFromString,
    getFullMonthName,
    getNormalYearMonthDayFromDate,

} from 'utils/dates.utils';
import CalendarCell from './CalendarCell';
import {useAppSelector} from "../../../app/hooks";
import {selectHoverUser, selectSelMode} from "../../../slices/availabilitiesSelection";
import {useGetCurrentMeetingWithSelector} from "../../../utils/meetings.hooks";
import type {PeopleDateTimes} from "../../../common/types";

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

export default function Calendar({firstVisibleDate, tentativeDates, allowEdit}: {firstVisibleDate: string, tentativeDates: string[], allowEdit: boolean}) {
    const {respondents, scheduledDateTime} = useGetCurrentMeetingWithSelector(
        ({data: meeting}) => ({
            respondents: meeting?.respondents,
            scheduledDateTime: meeting?.scheduledStartDateTime
        })
    );

  const [page, setPage] = useState(0);
  const firstSelectedDate_dayOfWeek = getDateFromString(firstVisibleDate).getDay();
  const firstDateInGridForPage0 = addDaysToDateString(firstVisibleDate, -firstSelectedDate_dayOfWeek);
  const firstDateInGrid = addDaysToDateString(firstDateInGridForPage0, 35 * page);

    const nextMonthStartDate = addDaysToDateString(firstDateInGrid, 35);

    // Find the first tentativeDate after the current page
    const nextDateWithEvent = tentativeDates
        .map(date => getDateFromString(date))
        .filter(date => date > getDateFromString(nextMonthStartDate))
        .sort((a, b) => a.getTime() - b.getTime())[0];

    // Find the last tentative date before the current page
    const previousDateWithEvent = tentativeDates
        .map(date => getDateFromString(date))
        .filter(date => date < getDateFromString(firstDateInGrid))
        .sort((a, b) => b.getTime() - a.getTime())[0];

    // Calculate the page to jump to
    const nextPage = nextDateWithEvent
        ? Math.floor(
            (nextDateWithEvent.getTime() - getDateFromString(firstDateInGridForPage0).getTime()) /
            (35 * 24 * 60 * 60 * 1000)
        )
        : null;


    const previousPage = previousDateWithEvent
        ? Math.floor(
            (previousDateWithEvent.getTime() - getDateFromString(firstDateInGridForPage0).getTime()) /
            (35 * 24 * 60 * 60 * 1000)
        )
        : null;

    const hoverUser = useAppSelector(selectHoverUser);
    const selMode = useAppSelector(selectSelMode);
    const totalPeople = Object.keys(respondents ?? {}).length;

    const dateTimePeople = useMemo(() => {
        const availabilities: PeopleDateTimes = {};
        for (const [respondentID, respondent] of Object.entries(respondents ?? {})) {
            availabilities[respondentID] = respondent.availabilities;
        }
        return createDateTimePeople(availabilities);
    }, [respondents]);



    const somebodyIsHovered = hoverUser !== null;
    const somebodyIsSelected = selMode.type === 'selectedUser';

    const scheduledDate = scheduledDateTime?.split("T")[0];


    const highlightedAvailabilities = (somebodyIsSelected && respondents !== undefined) ?
        respondents[selMode.selectedRespondentID].availabilities :
        (
            (somebodyIsHovered && respondents !== undefined) ? respondents[hoverUser].availabilities : {}
        );



    const monthCells = range(35).map((cellIdx) => (
    <CalendarCell
      key={cellIdx}
      firstVisibleDate={firstVisibleDate}
      firstDateInGrid={firstDateInGrid}
      cellIdx={cellIdx}
      allowEdit={allowEdit}
      enabled={tentativeDates.includes(addDaysToDateString(firstDateInGrid, cellIdx+1))}
      highlighted={highlightedAvailabilities[addDaysToDateString(firstDateInGrid, cellIdx + 1)]}
      availablePeople={dateTimePeople[addDaysToDateString(firstDateInGrid, cellIdx + 1)]?.length ?? 0}
      totalPeople={totalPeople}
      scheduledDate={scheduledDate === addDaysToDateString(firstDateInGrid, cellIdx + 1)}
      showRepondents={(!somebodyIsHovered && !somebodyIsSelected && !allowEdit && selMode.type === 'none') || selMode.type === 'editingSchedule'}
      singleDateAllowed={selMode.type === 'editingSchedule'}
    />
  ));

  const leftArrow = (
    <div className="d-flex align-items-center ms-0 ms-md-3">
      <SVGLeftArrow
        className={page > 0 ? 'visible' : 'invisible'}
        onClick={() => setPage(previousPage!)}
      />
    </div>
  );
  const rightArrow = (
    <div className="d-flex align-items-center ms-0 ms-md-3">
      <SVGRightArrow onClick={() => setPage(nextPage!)} className={nextDateWithEvent ? 'visible' : 'invisible'}/>
    </div>
  );

  return (
      <>
          <CalendarMonthTextCell date={firstDateInGrid}/>
          <div style={{display: 'flex', flexFlow: 'row nowrap'}}>
              {leftArrow}
              <div className="event-daypicker-calendar">
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
        <div key={day} className="event-daypicker-dayofweek-cell">
          {day}
        </div>
      ))}
    </>
  );
});
