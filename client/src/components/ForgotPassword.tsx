import React, { useEffect, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { useToast } from 'components/Toast';
import styles from './ForgotPassword.module.css';
import ButtonWithSpinner from './ButtonWithSpinner';
import { useResetPasswordMutation } from 'slices/api';
import { getReqErrorMessage } from 'utils/requests.utils';
import useSetTitle from 'utils/title.hook';

 export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [resetPasswordAtLeastOnce, setResetPasswordAtLeastOnce] = useState(false);

  useSetTitle('Forgot Password');

  return (
    <div className="d-flex justify-content-center">
      {
        resetPasswordAtLeastOnce
        ? <PasswordResetConfirmation email={email} />
        : <ForgotPasswordForm {...{email, setEmail, setResetPasswordAtLeastOnce}} />
      }
    </div>
  )
 };

function ForgotPasswordForm({
  email,
  setEmail,
  setResetPasswordAtLeastOnce,
} : {
  email: string,
  setEmail: (email: string) => void,
  setResetPasswordAtLeastOnce: (val: boolean) => void,
}) {
  const [validated, setValidated] = useState(false);
  const [resetPassword, {isLoading, isSuccess, error}] = useResetPasswordMutation();
  const canSendRequest = !isLoading && !isSuccess;
  const submitBtnDisabled = !canSendRequest;
  let onSubmit: React.FormEventHandler<HTMLFormElement> | undefined;
  if (canSendRequest) {
    onSubmit = (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      if (form.checkValidity()) {
        resetPassword({email});
      } else {
        setValidated(true);
      }
    };
  }

  useEffect(() => {
    if (isSuccess) {
      setResetPasswordAtLeastOnce(true);
    }
  }, [isSuccess, setResetPasswordAtLeastOnce]);

  return (
    <Form noValidate className={styles.forgotPasswordForm} {...{validated, onSubmit}}>
      <h4 className="mb-5">Unohtuiko salasana?</h4>
      <p>
        Syötä tilii sähköpostiosoite. Jos tili on olemassa, saat sähköpostiviestin.
      </p>
      <Form.Group controlId="forgotpassword-form-email" className="mt-5">
        <Form.Label>Sähköpostiosoite</Form.Label>
        <Form.Control
          required
          placeholder="bossman@nummarit.fi"
          type="email"
          className="form-text-input"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
        <Form.Control.Feedback type="invalid">
          Sähköpostiosoite on väärin
        </Form.Control.Feedback>
      </Form.Group>
      <ButtonWithSpinner
        as="NonFocusButton"
        className="d-none d-md-block btn btn-outline-primary mt-4"
        type="submit"
        isLoading={submitBtnDisabled}
      >
        Nollaa salasana
      </ButtonWithSpinner>
      {error && (
        <p className="text-danger mb-0 mt-3">Tapahtui virhe: {getReqErrorMessage(error)}</p>
      )}
    </Form>
  );
}

function PasswordResetConfirmation({
  email,
}: {
  email: string,
}) {
  const { showToast } = useToast();
  const [resetPassword, {isLoading, isSuccess, error}] = useResetPasswordMutation();
  const submitBtnDisabled = isLoading;
  const canSendRequest = !submitBtnDisabled;
  let onClick: React.MouseEventHandler | undefined;
  if (canSendRequest) {
    onClick = () => resetPassword({email});
  }

  useEffect(() => {
    if (isSuccess) {
      showToast({
        msg: 'Nollauspyyntö lähetetty',
        msgType: 'success',
        autoClose: true,
      });
    }
  }, [isSuccess, showToast]);

  return (
    <div className={styles.passwordResetConfirmation}>
      <h4 className="mb-5">Sähköpostiosoite lähetetty!</h4>
      <p>
          Jos tili on olemassa, saat sähköpostin, jossa on linkki salasanan nollaamiseen. Jos yli 10 minuuttia on kulunut ja
          et ole vieläkään saanut viestiä, paina alla olevaa Lähetä uudelleen -painiketta vastaanottaaksesi
          uuden sähköpostin.
      </p>
      <ButtonWithSpinner
        as="NonFocusButton"
        className="d-none d-md-block btn btn-outline-primary mt-4"
        isLoading={submitBtnDisabled}
        onClick={onClick}
      >
        Lähetä uudelleen
      </ButtonWithSpinner>
      {error && (
        <p className="text-danger mb-0 mt-3">Tapahtui virhe: {getReqErrorMessage(error)}</p>
      )}
    </div>
  );
}
