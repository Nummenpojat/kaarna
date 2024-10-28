import React from 'react';
import Form from 'react-bootstrap/Form';
import BottomOverlay from 'components/BottomOverlay';
import ButtonWithSpinner from 'components/ButtonWithSpinner';

export default function MeetingNamePrompt({
  meetingName,
  setMeetingName,
  isLoading,
}: {
  meetingName: string,
  setMeetingName: (name: string) => void,
  isLoading: boolean,
}) {
  return (
    <Form.Group className="d-flex align-items-center">
      <Form.Control
        placeholder="Nimeä tapaaminen"
        className="create-meeting-question form-text-input flex-grow-1"
        autoFocus
        value={meetingName}
        onChange={(ev) => setMeetingName(ev.target.value)}
      />
      <ButtonWithSpinner
        className="btn btn-primary d-none d-md-block ms-md-4 create-meeting-button"
        tabIndex={-1}
        type="submit"
        disabled={meetingName === '' || isLoading}
        isLoading={isLoading}
      >
        Luo
      </ButtonWithSpinner>
      <BottomOverlay>
        <ButtonWithSpinner
          className="btn btn-light ms-auto create-meeting-button"
          tabIndex={-1}
          type="submit"
          disabled={meetingName === '' || isLoading}
          isLoading={isLoading}
        >
          Luo
        </ButtonWithSpinner>
      </BottomOverlay>
    </Form.Group>
  );
}
