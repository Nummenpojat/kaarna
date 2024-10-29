import {useMemo} from "react";
import {useAppSelector} from "app/hooks";
import {
  OAuth2CalendarEventsResponseItem,
  useGetExternalGoogleCalendarEventsQuery,
  useGetGoogleCalendarEventsQuery,
  useGetMicrosoftCalendarEventsQuery,
  useGetSelfInfoQuery,
} from "slices/api";
import {selectTokenIsPresent} from "slices/authentication";
import {selectCurrentMeetingID} from "slices/currentMeeting";
import {useGetMeetingQuery} from "slices/enhancedApi";
import {TransformedMeetingResponse} from "./response-transforms";

export function useGetCurrentMeeting() {
  const meetingID = useAppSelector(selectCurrentMeetingID);
  return useGetMeetingQuery(meetingID ?? '', {skip: meetingID === undefined});
}

export function useGetCurrentMeetingWithSelector<T extends Record<string, any>>(
  select: ({data}: {data?: TransformedMeetingResponse}) => T,
) {
  const meetingID = useAppSelector(selectCurrentMeetingID);
  const queryInfo = useGetMeetingQuery(meetingID ?? '', {
    skip: meetingID === undefined,
    selectFromResult: select,
  });
  return queryInfo;
}

export function useGetExternalCalendarEventsIfTokenIsPresent(meetingID: string) {
  const tokenIsPresent = useAppSelector(selectTokenIsPresent);
  const {data: userInfo} = useGetSelfInfoQuery(undefined, {skip: !tokenIsPresent});
  const hasLinkedGoogleAccount = userInfo?.hasLinkedGoogleAccount || false;
  const hasLinkedMicrosoftAccount = userInfo?.hasLinkedMicrosoftAccount || false;
  const hasLinkedExternalGoogleAccount = userInfo?.hasLinkedExternalGoogleAccount || false;
  const {data: googleResponse} = useGetGoogleCalendarEventsQuery(meetingID, {skip: !tokenIsPresent || !hasLinkedGoogleAccount});
  const {data: microsoftResponse} = useGetMicrosoftCalendarEventsQuery(meetingID, {skip: !tokenIsPresent || !hasLinkedMicrosoftAccount});
  const {data: externalGoogleResponse} = useGetExternalGoogleCalendarEventsQuery(meetingID, {skip: !tokenIsPresent || !hasLinkedExternalGoogleAccount});
  const mergedEvents = useMemo(() => {
    const result: OAuth2CalendarEventsResponseItem[] = [];
    if (googleResponse) result.push(...googleResponse.events);
    if (microsoftResponse) result.push(...microsoftResponse.events);
    if (externalGoogleResponse) result.push(...externalGoogleResponse.events);
    return result.sort((a,b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
  }, [googleResponse, microsoftResponse, externalGoogleResponse]);
  return mergedEvents;
}
