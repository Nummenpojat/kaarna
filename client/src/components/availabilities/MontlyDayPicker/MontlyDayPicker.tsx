import Calendar from "./Calendar";
import AvailabilitiesRow from "../AvailabilitiesRow";
import React, {useEffect, useState} from "react";
import {useAppDispatch, useAppSelector} from "../../../app/hooks";
import {selectSelMode, SelMode} from "../../../slices/availabilitiesSelection";
import {isMobile} from "react-device-detect";
import MeetingRespondents from "../MeetingRespondents";
import {addDate, resetSelectedDates} from "../../../slices/selectedDates";
import {useGetCurrentMeetingWithSelector} from "../../../utils/meetings.hooks";
import {assert} from "../../../utils/misc.utils";

interface MonthlyDayPickerProps {
    tentativeDates: string[]; // Pre-selected dates (optional)
    onSelectDate?: (selectedDates: string[]) => void; // Callback when dates are selected
}

export default function MonthlyDayPicker({
                                             tentativeDates
                                         }: MonthlyDayPickerProps) {
    const dispatch = useAppDispatch();
    const selModeType = useAppSelector(state => selectSelMode(state).type);
    const selMode = useAppSelector(selectSelMode);
    const {respondents} = useGetCurrentMeetingWithSelector(
        ({data: meeting}) => ({
            respondents: meeting?.respondents,
        })
    );


    useEffect(() => {
        if (selMode.type === 'editingRespondent') {
            dispatch(resetSelectedDates())
            // @ts-ignore
            Object.keys(respondents[selMode.respondentID].availabilities).forEach(i => dispatch(addDate(i)));
        }
        if (selMode.type === 'none') {
            dispatch(resetSelectedDates())
        }
    }, [dispatch, respondents, selMode])


    return (
        <>
            <AvailabilitiesRow moreDaysToRight={false} pageDispatch={() => {}} />
            <div className="d-md-flex mt-2 mt-md-5">
                <div className={"flex-md-grow-1"}>
                    <Calendar
                        firstVisibleDate={tentativeDates[0]}
                        tentativeDates={tentativeDates}
                        allowEdit={(selModeType === 'addingRespondent' || selModeType === 'editingRespondent' || selModeType === 'editingSchedule')}
                    />
                </div>
                {(!isMobile || selModeType === 'none') && <MeetingRespondents />}
            </div>
        </>
    );
}
