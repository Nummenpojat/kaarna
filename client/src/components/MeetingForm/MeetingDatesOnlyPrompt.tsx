import React, {ChangeEvent} from 'react';
import Form from 'react-bootstrap/Form';

export default function MeetingDatesOnlyPrompt({
                                                meetingDatesOnly,
                                                setMeetingDatesOnly,
}: {
    meetingDatesOnly: boolean,
    setMeetingDatesOnly: (datesOnly: boolean) => void },
) {
  const onMeetingAboutChange = (e: ChangeEvent<HTMLInputElement>) => {
      setMeetingDatesOnly(e.target.checked);
  };
  return (
    <Form.Group controlId="meeting-dates-only-prompt" className="create-meeting-form-group">
        <Form.Check type={"switch"}>
            <Form.Check.Input
                type={"checkbox"}
                defaultChecked={meetingDatesOnly}
                onChange={onMeetingAboutChange}
            >
        </Form.Check.Input>
            <Form.Check.Label className="create-meeting-question">
                Järjestä ilman kellonaikaa
            </Form.Check.Label>
      </Form.Check>
    </Form.Group>
  );
}
