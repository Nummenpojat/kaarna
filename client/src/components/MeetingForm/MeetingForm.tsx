import { useEffect, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { useNavigate } from 'react-router-dom';
import { resetSelectedDates, selectSelectedDates } from 'slices/selectedDates';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import './MeetingForm.css';
import MeetingNamePrompt from './MeetingNamePrompt';
import MeetingAboutPrompt from './MeetingAboutPrompt';
import MeetingTimesPrompt from './MeetingTimesPrompt';
import { useCreateMeetingMutation } from 'slices/api';
import { getReqErrorMessage } from 'utils/requests.utils';
import { ianaTzName } from 'utils/dates.utils';
import MeetingGuestsPrompt from "./MeetingGuestsPrompt";
import MeetingDatesOnlyPrompt from "./MeetingDatesOnlyPrompt";

type MeetingFormProps = {
  allowGuests?: boolean;
};

export default function MeetingForm({allowGuests}: MeetingFormProps)  {
  const [meetingName, setMeetingName] = useState('');
  const [meetingAbout, setMeetingAbout] = useState('');
  const [meetingGuests, setMeetingGuests] = useState(allowGuests ?? true);
  const [meetingDatesOnly, setMeetingDatesOnly] = useState(false);
  const [startTime, setStartTime] = useState(9);
  const [endTime, setEndTime] = useState(17);
  const dispatch = useAppDispatch();
  const dates = useAppSelector(selectSelectedDates);
  const [createMeeting, {data, isLoading, isSuccess, error}] = useCreateMeetingMutation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSuccess) {
      dispatch(resetSelectedDates());
      navigate('/m/' + data!.meetingID);
    }
  }, [data, isSuccess, dispatch, navigate]);

  if (isSuccess) {
    // we're about to switch to a different URL
    return null;
  }
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (ev) => {
    ev.preventDefault();
    if (meetingName === '') {
      // TODO: use form validation to provide visual feedback
      return;
    }
    createMeeting({
      name: meetingName,
      about: meetingAbout,
      timezone: ianaTzName,
      minStartHour: meetingDatesOnly ? 0 : startTime,
      maxEndHour: meetingDatesOnly ? 0 : endTime,
      allowGuests: meetingGuests,
      datesOnly: meetingDatesOnly,
      tentativeDates: Object.keys(dates),
    });
  };
  return (
    <Form className="create-meeting-page" onSubmit={onSubmit}>
      <MeetingNamePrompt
        meetingName={meetingName}
        setMeetingName={setMeetingName}
        isLoading={isLoading}
      />
      {error && (
        <p className="text-danger text-center mt-3">Tapahtui virhe: {getReqErrorMessage(error)}</p>
      )}
      <MeetingAboutPrompt
        meetingAbout={meetingAbout}
        setMeetingAbout={setMeetingAbout}
      />
      <MeetingGuestsPrompt {...{meetingGuests, setMeetingGuests}}/>
      <MeetingDatesOnlyPrompt {...{meetingDatesOnly, setMeetingDatesOnly}} />
      {!meetingDatesOnly && <MeetingTimesPrompt
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
      />}
    </Form>
  );
}
