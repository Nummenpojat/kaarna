import { useState, useEffect } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import ButtonWithSpinner from 'components/ButtonWithSpinner';
import { useAddGuestRespondentMutation } from 'slices/api';
import { selectSelectedTimes, resetSelection } from 'slices/availabilitiesSelection';
import { selectCurrentMeetingID } from 'slices/currentMeeting';
import { assert } from 'utils/misc.utils';
import { getReqErrorMessage } from 'utils/requests.utils';
import styles from './SubmitAsGuestModal.module.css';
import {selectSelectedDates} from "../../slices/selectedDates";

function SaveTimesModal({
  show, setShow, datesOnly
}: {
  show: boolean, setShow: (val: boolean) => void, datesOnly: boolean
}) {
  const meetingID = useAppSelector(selectCurrentMeetingID);
  assert(meetingID !== undefined);
  const selectedTimes = useAppSelector(selectSelectedTimes);
  const selectedDates = useAppSelector(selectSelectedDates);
  const dispatch = useAppDispatch();
  const [addGuest, {isSuccess, isLoading, error, reset}] = useAddGuestRespondentMutation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    if (!show) {
      reset();
      setName('');
      setEmail('');
      setValidated(false);
    }
  }, [show, reset]);

  useEffect(() => {
    if (isSuccess) {
      dispatch(resetSelection());
      // automatically close the modal if the request succeeds
      setShow(false);
    }
  }, [isSuccess, dispatch, setShow]);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    addGuest({
      id: meetingID,
      addGuestRespondentDto: {
        availabilities: Object.keys(selectedTimes),
        dayAvailabilities: Object.keys(selectedDates),
        name,
        email: email || undefined,
      },
    });
  };
  const onClose = () => {
    if (isLoading) return;
    setShow(false);
  };

  const submitBtnDisabled = isLoading || name === '';
  return (
    <Modal
      backdrop="static"
      show={show}
      onHide={onClose}
      centered={true}
    >
      <Modal.Header closeButton>
        <Modal.Title>Ilmoittaudu vieraana</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form noValidate id="saveTimesModal" className="my-3" {...{validated, onSubmit}}>
          <Form.Group controlId="submitSelfName">
            <Form.Label className="form-text-label">Nimi</Form.Label>
            <Form.Control
              required
              placeholder="Petteri Punakuono"
              className="form-text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Form.Control.Feedback type="invalid">
              Please enter your name.
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="submitSelfEmail" className="mt-4">
            <Form.Label className="form-text-label">Sähköpostiosoite (valinnainen)</Form.Label>
            <Form.Control
              type="email"
              placeholder="bossman@nummarit.fi"
              className="form-text-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Form.Control.Feedback type="invalid">
              Sähköpostiosoite on väärin, tarkista osoite!
            </Form.Control.Feedback>
          </Form.Group>
        </Form>
        <div className={`text-danger text-center ${error ? '' : 'in'}visible`}>
          Sopivien aikojen tallennus epäonnistui: {error ? getReqErrorMessage(error) : ''}
        </div>
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <Link className={styles.alreadyHaveAccount} to="/login">
          Onko sinulla Nummaritili?
        </Link>
        <ButtonWithSpinner
          as="NonFocusButton"
          type="submit"
          form="saveTimesModal"
          className="btn btn-primary"
          disabled={submitBtnDisabled}
          isLoading={isLoading}
        >
          Ilmoittaudu
        </ButtonWithSpinner>
      </Modal.Footer>
    </Modal>
  )
}
export default SaveTimesModal;
