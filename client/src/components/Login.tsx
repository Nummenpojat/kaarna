import React, { useContext, useEffect, useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { Link, useNavigate } from 'react-router-dom';
import BottomOverlay from 'components/BottomOverlay';
import ButtonWithSpinner from 'components/ButtonWithSpinner';
import { HistoryContext } from 'components/HistoryProvider';
import OAuth2ProviderButtons from 'components/OAuth2ProviderButtons';
import { useLoginMutation } from 'slices/api';
import { getReqErrorMessage, useMutationWithPersistentError } from "utils/requests.utils";
import styles from './Login.module.css';
import useSetTitle from 'utils/title.hook';
import WaitForServerInfo from './WaitForServerInfo';

// TODO: reduce code duplication with Signup.tsx

export default function Login() {
  return (
    <WaitForServerInfo>
      <div className="d-flex justify-content-center">
        <LoginForm />
      </div>
    </WaitForServerInfo>
  );
};

function LoginForm() {
  const [validated, setValidated] = useState(false);
  const navigate = useNavigate();
  const [login, {isUninitialized, isLoading, isSuccess, isError, error}] = useMutationWithPersistentError(useLoginMutation);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const {lastNonAuthPath} = useContext(HistoryContext);
  // Ref is used to avoid triggering a useEffect hook twice
  const lastNonAuthPathRef = useRef('/');
  let onSubmit: React.FormEventHandler<HTMLFormElement> | undefined;
  const submitBtnDisabled = isLoading;
  if (isUninitialized || isError) {
    onSubmit = (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      if (form.checkValidity()) {
        login({
          email: emailRef.current!.value,
          password: passwordRef.current!.value,
        });
      } else {
        setValidated(true);
      }
    };
  }

  useSetTitle('Kirjaudu sisään');

  useEffect(() => {
    lastNonAuthPathRef.current = lastNonAuthPath;
  }, [lastNonAuthPath]);

  useEffect(() => {
    if (isSuccess) {
      navigate(lastNonAuthPathRef.current);
    }
  }, [isSuccess, navigate]);

  return (
    <Form noValidate className={styles.loginForm} {...{validated, onSubmit}}>
      <OAuth2ProviderButtons reason="login" />
      <Form.Group controlId="login-form-email">
        <Form.Label>Sähköpostiosoite</Form.Label>
        <Form.Control
          required
          placeholder="bossman@nummarit.fi"
          type="email"
          className="form-text-input"
          ref={emailRef}
        />
        <Form.Control.Feedback type="invalid">
          Sähköposti on virheellinen
        </Form.Control.Feedback>
      </Form.Group>
      <Form.Group controlId="login-form-password" className="mt-5">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <Form.Label className="mb-0">Salasana</Form.Label>
          <Link to="/forgot-password" className={`custom-link ${styles.forgotPasswordLink}`} tabIndex={-1}>
            Unohtuiko salasana
          </Link>
        </div>
        <Form.Control
          required
          placeholder="**********"
          type="password"
          className="form-text-input"
          ref={passwordRef}
        />
        <Form.Control.Feedback type="invalid">
          Syötä salasana
        </Form.Control.Feedback>
      </Form.Group>
      {error && (
        <p className="text-danger text-center mb-0 mt-3">
          Tapahtui virhe: {getReqErrorMessage(error)}
        </p>
      )}
      <SignUpOrLogin disabled={submitBtnDisabled} />
    </Form>
  );
}

function SignUpOrLogin({ disabled } : { disabled: boolean }) {
  return (
    <>
      <div className="d-none d-md-flex align-items-center justify-content-between mt-5">
        <ButtonWithSpinner
          type="submit"
          className="btn btn-outline-primary"
          isLoading={disabled}
        >
          Kirjaudu
        </ButtonWithSpinner>
      </div>
      <BottomOverlay>
        <ButtonWithSpinner
          type="submit"
          className="btn btn-light ms-auto"
          isLoading={disabled}
        >
          Kirjaudu
        </ButtonWithSpinner>
      </BottomOverlay>
    </>
  );
}
