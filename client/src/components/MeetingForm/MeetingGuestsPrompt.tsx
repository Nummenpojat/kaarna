import React, {ChangeEvent} from 'react';
import Form from 'react-bootstrap/Form';

export default function MeetingGuestsPrompt({
                                                meetingGuests,
  setMeetingGuests,
}: {
    meetingGuests: boolean,
    setMeetingGuests: (allow: boolean) => void },
) {
  const onMeetingAboutChange = (e: ChangeEvent<HTMLInputElement>) => {
      setMeetingGuests(e.target.checked);
  };
  return (
    <Form.Group controlId="meeting-guests-prompt" className="create-meeting-form-group">
        <Form.Check type={"checkbox"}>
            <Form.Check.Input
                type={"checkbox"}
                defaultChecked={meetingGuests}
                onChange={onMeetingAboutChange}
            >
        </Form.Check.Input>
            <Form.Check.Label className="create-meeting-question">
                Salli ilmoittautuminen ilman kirjautumista
            </Form.Check.Label>
      </Form.Check>
    </Form.Group>
  );
}
