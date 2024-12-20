import { useEffect, useMemo, useRef, useState } from "react";
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import { Link, useNavigate } from "react-router-dom";
import { useAppSelector } from "app/hooks";
import BottomOverlay from "components/BottomOverlay";
import ButtonWithSpinner from "components/ButtonWithSpinner";
import GenericSpinner from "components/GenericSpinner";
import NonFocusButton from "components/NonFocusButton";
import {
  selectTokenIsPresent,
} from "slices/authentication";
import CreatedOrRespondedMeetings from "./CreatedOrRespondedMeetings";
import styles from './Profile.module.css';
import { useGetSelfInfoQuery, useLogoutMutation } from "slices/api";
import { useGetSelfInfoIfTokenIsPresent } from "utils/auth.hooks";
import { getReqErrorMessage, useMutationWithPersistentError } from "utils/requests.utils";
import { scrollUpIntoViewIfNeeded } from "utils/misc.utils";
import useSetTitle from "utils/title.hook";

export default function Profile() {
  const tokenIsPresent = useAppSelector(selectTokenIsPresent);
  const {data: userInfo, isError} = useGetSelfInfoQuery(undefined, {skip: !tokenIsPresent});
  const userInfoIsPresent = !!userInfo;
  const shouldBeRedirectedToHomePage = !tokenIsPresent || isError;
  const navigate = useNavigate();
  const [seeCreatedMeetings, setSeeCreatedMeetings] = useState(true);

  useEffect(() => {
    if (shouldBeRedirectedToHomePage) {
      navigate('/');
    }
  }, [shouldBeRedirectedToHomePage, navigate]);

  const title = useMemo(
    () => userInfo ? userInfo.name + " profiili" : undefined,
    [userInfo]
  );
  useSetTitle(title);

  if (shouldBeRedirectedToHomePage) {
    return null;
  }

  if (!userInfoIsPresent) {
    return <GenericSpinner />;
  }

  return (
    <div className="flex-grow-1 d-flex flex-column">
      <Heading />
      <CreatedRespondedToggle {...{seeCreatedMeetings, setSeeCreatedMeetings}} />
      <div className="flex-grow-1 d-flex flex-column align-items-center">
        <CreatedOrRespondedMeetings showCreatedMeetings={seeCreatedMeetings} />
      </div>
    </div>
  );
};

function Heading() {
  const [logout, {isLoading, error}] = useMutationWithPersistentError(useLogoutMutation);
  const {data: userInfo} = useGetSelfInfoIfTokenIsPresent();
  const onSignoutClick = () => logout(false);
  const errorMessageElemRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) {
      // We need to wait until the <p> element actually becomes visible
      // before scrolling to it
      setTimeout(() => {
        scrollUpIntoViewIfNeeded(errorMessageElemRef.current!, 48);
      }, 1);
    }
  }, [error]);

  let visibilityClass = "visible";
  if (userInfo === null) {
    // To prevent "waterfalling" of network requests, we allow this component
    // to load even if user data has not loaded yet. If it turns out that
    // the user is not logged in, they will get redirected to the home page.
    visibilityClass = "invisible";
  }

  const signoutBtnDisabled = isLoading;

  return (
    <>
      <div className={`d-flex align-items-center ${visibilityClass}`}>
        <h5 className="mb-0">
          {userInfo?.name}
        </h5>
        <ButtonWithSpinner
          className="d-none d-md-block btn btn-outline-danger ms-auto"
          isLoading={signoutBtnDisabled}
          onClick={onSignoutClick}
        >
          Kirjaudu ulos
        </ButtonWithSpinner>
        <Link to="/me/settings" className="text-decoration-none">
          <button className="d-none d-md-block btn btn-primary custom-btn-min-width ms-3">
            Asetukset
          </button>
        </Link>
        <BottomOverlay>
          <Link to="/me/settings" className="text-decoration-none">
            <button className="btn btn-light custom-btn-min-width">
              Asetukset
            </button>
          </Link>
          <ButtonWithSpinner
            className="btn btn-light ms-auto"
            isLoading={signoutBtnDisabled}
            onClick={onSignoutClick}
          >
            Kirjaudu ulos
          </ButtonWithSpinner>
        </BottomOverlay>
      </div>
      <p
        className={`text-danger text-center mb-0 mt-3 d-${error ? 'block' : 'none'}`}
        ref={errorMessageElemRef}
      >
        Ei voitu kirjautua ulos: {error ? getReqErrorMessage(error) : ''}
      </p>
    </>
  );
}

function CreatedRespondedToggle({
  seeCreatedMeetings,
  setSeeCreatedMeetings,
}: {
  seeCreatedMeetings: boolean,
  setSeeCreatedMeetings: (val: boolean) => void,
}) {
  const onCreatedClick = () => setSeeCreatedMeetings(true);
  const onRespondedClick = () => setSeeCreatedMeetings(false);
  return (
    <ButtonGroup
      className="d-flex justify-content-center mt-5"
      aria-label="Choose created or responded meetings"
    >
      <NonFocusButton
        className={`btn ${seeCreatedMeetings ? 'btn-primary' : 'btn-outline-primary'} flex-grow-0 ${styles.createdRespondedButton}`}
        onClick={onCreatedClick}
      >
        Omat
      </NonFocusButton>
      <NonFocusButton
        className={`btn ${seeCreatedMeetings ? 'btn-outline-primary' : 'btn-primary'} flex-grow-0 ${styles.createdRespondedButton}`}
        onClick={onRespondedClick}
      >
        Muut
      </NonFocusButton>
    </ButtonGroup>
  );
}
