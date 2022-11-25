import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { Link, useNavigate } from 'react-router-dom';
import BottomOverlay from 'components/BottomOverlay';
import ContinueWithGoogleButton from 'components/ContinueWithGoogleButton';
import { useToast } from 'components/Toast';
import styles from './Signup.module.css';
import { getReqErrorMessage } from 'utils/requests.utils';
import ButtonWithSpinner from './ButtonWithSpinner';
import { useSignupMutation } from 'slices/api';
import { HistoryContext } from './HistoryProvider';
import { isVerifyEmailAddressResponse } from 'slices/enhancedApi';
import VerifyEmailAddress from './VerifyEmailAddress';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shouldShowVerificationPage, setShouldShowVerificationPage] = useState(false);
  const navigate = useNavigate();
  const {lastNonAuthPath} = useContext(HistoryContext);
  // Ref is used to avoid creating a new callback after the redirect, which would
  // force the child components to re-render
  // TODO: encapsulate this in a separate hook
  const lastNonAuthPathRef = useRef('/');
  useEffect(() => { lastNonAuthPathRef.current = lastNonAuthPath; }, [lastNonAuthPath]);
  const redirectAfterSuccessfulSignup = useCallback(() => {
    navigate(lastNonAuthPathRef.current);
  }, [navigate]);

  if (shouldShowVerificationPage) {
    return <VerifyEmailAddress {...{name, email, password, redirectAfterSuccessfulSignup}} />;
  }
  return (
    <div className={styles.signupContainer}>
      <SignupForm {...{
        name, setName, email, setEmail, password, setPassword,
        setShouldShowVerificationPage, redirectAfterSuccessfulSignup,
      }} />
      <WhyShouldISignUp />
    </div>
  );
};

function SignupForm({
  name, setName,
  email, setEmail,
  password, setPassword,
  setShouldShowVerificationPage,
  redirectAfterSuccessfulSignup,
}: {
  name: string, setName: (s: string) => void,
  email: string, setEmail: (s: string) => void,
  password: string, setPassword: (s: string) => void,
  setShouldShowVerificationPage: (b: boolean) => void,
  redirectAfterSuccessfulSignup: () => void,
}) {
  const [validated, setValidated] = useState(false);
  const [signup, {data, isLoading, isSuccess, isError, error}] = useSignupMutation();
  const { showToast } = useToast();
  let onSubmit: React.FormEventHandler<HTMLFormElement> | undefined;
  const submitBtnDisabled = isLoading;
  if (!submitBtnDisabled) {
    onSubmit = (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      if (form.checkValidity()) {
        signup({
          name,
          email,
          password,
        });
      } else {
        setValidated(true);
      }
    };
  }

  useEffect(() => {
    if (isError) {
      showToast({
        msg: `An error occurred: ${getReqErrorMessage(error!)}`,
        msgType: 'failure',
      });
    } else if (isSuccess) {
      if (isVerifyEmailAddressResponse(data!)) {
        setShouldShowVerificationPage(true);
      } else {
        redirectAfterSuccessfulSignup();
      }
    }
  }, [
    data, isError, error, isSuccess,
    setShouldShowVerificationPage, redirectAfterSuccessfulSignup,
    showToast,
  ]);

  return (
    <Form noValidate className={styles.signupForm} {...{validated, onSubmit}}>
      <h4 className="mb-5">Sign up</h4>
      <ContinueWithGoogleButton reason='signup' />
      <div className="d-flex align-items-center my-4">
        <div className="border-top flex-grow-1"></div>
        <span className="fw-bold mx-2">OR</span>
        <div className="border-top flex-grow-1"></div>
      </div>
      <Form.Group controlId="signup-form-name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          required
          placeholder="What's your name?"
          minLength={1}
          className="form-text-input"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
        <Form.Control.Feedback type="invalid">Please enter a name.</Form.Control.Feedback>
      </Form.Group>
      <Form.Group controlId="signup-form-email" className="mt-5">
        <Form.Label>Email address</Form.Label>
        <Form.Control
          required
          placeholder="What's your email address?"
          type="email"
          className="form-text-input"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
        <Form.Control.Feedback type="invalid">
          Please enter a valid email address.
        </Form.Control.Feedback>
      </Form.Group>
      <Form.Group controlId="signup-form-password" className="mt-5">
        <Form.Label>Password</Form.Label>
        <Form.Control
          required
          minLength={6}
          maxLength={30}
          placeholder="What would you like your password to be?"
          type="password"
          className="form-text-input"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
        />
        <Form.Control.Feedback type="invalid">
          Password must be between 6-30 characters.
        </Form.Control.Feedback>
      </Form.Group>
      <SignUpOrLogin disabled={submitBtnDisabled} />
    </Form>
  );
}

function SignUpOrLogin({ disabled } : { disabled: boolean }) {
  return (
    <>
      <div className="d-none d-md-flex align-items-center justify-content-between mt-5">
        <Link to="/login" className={`custom-link ${styles.alreadyHaveAccountLink}`}>
          Already have an account?
        </Link>
        <ButtonWithSpinner
          type="submit"
          className="btn btn-outline-primary"
          isLoading={disabled}
        >
          Sign up
        </ButtonWithSpinner>
      </div>
      <BottomOverlay>
        <Link to="/login" className={`custom-link custom-link-inverted ${styles.alreadyHaveAccountLink}`}>
          Already have an account?
        </Link>
        <ButtonWithSpinner
          type="submit"
          className="btn btn-light ms-auto"
          isLoading={disabled}
        >
          Sign up
        </ButtonWithSpinner>
      </BottomOverlay>
    </>
  );
}

function WhyShouldISignUp() {
  return (
    <div className={styles.whyShouldISignUp}>
      <h4 className="mb-5">Why should I sign up?</h4>
      <div>
        <div className="text-primary">1&#41; Google calendar integration</div>
        <p className="mt-2">
          Check for conflicts with your Google calendar events when filling
          out your availabilities.
        </p>
      </div>
      <div className="mt-5">
        <div className="text-primary">2&#41; All your meetings in one profile</div>
        <p className="mt-2">
          See all of the meetings which you've created or replied to from
          your profile. Your can also update your meeting info after
          creating it.
        </p>
      </div>
      <div className="mt-5">
        <div className="text-primary">3&#41; Notifications</div>
        <p className="mt-2">
          Get notified when someone responds to a meeting which you've created.
        </p>
      </div>
    </div>
  )
}
