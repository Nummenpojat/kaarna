import React, { useState, useEffect, useCallback, useRef } from "react";
import Form from 'react-bootstrap/Form';
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "app/hooks";
import NonFocusButton from "components/NonFocusButton";
import DeleteAccountModal from "./DeleteAccountModal";
import {
  selectTokenIsPresent,
} from "slices/authentication";
import { assert, capitalize } from "utils/misc.utils";
import { useToast } from "./Toast";
import styles from './Settings.module.css';
import GenericSpinner from "./GenericSpinner";
import { getReqErrorMessage, useMutationWithPersistentError } from "utils/requests.utils";
import {
  useEditUserMutation,
  useGetSelfInfoQuery,
  useLogoutMutation,
  useLinkGoogleCalendarMutation,
  useUnlinkGoogleCalendarMutation,
  useLinkMicrosoftCalendarMutation,
  useUnlinkMicrosoftCalendarMutation,
  useLinkExternalGoogleCalendarMutation,
  useUnlinkExternalGoogleCalendarMutation, useGetServerInfoQuery, ServerInfoResponse
} from "slices/api";
import ButtonWithSpinner from "./ButtonWithSpinner";
import { useGetSelfInfoIfTokenIsPresent } from "utils/auth.hooks";
import { calendarProductNames, OAuth2Provider } from "utils/oauth2-common";
import useSetTitle from "utils/title.hook";

export default function Settings() {
  const tokenIsPresent = useAppSelector(selectTokenIsPresent);
  const {data: userInfo, isError} = useGetSelfInfoQuery(undefined, {skip: !tokenIsPresent});
  const {data: serverInfo} = useGetServerInfoQuery();
  const userInfoIsPresent = !!userInfo;
  const shouldBeRedirectedToHomePage = !tokenIsPresent || isError;
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldBeRedirectedToHomePage) {
      navigate('/');
    }
  }, [shouldBeRedirectedToHomePage, navigate]);

  useSetTitle('Profiiliasetukset');

  if (shouldBeRedirectedToHomePage) {
    return null;
  }

  if (!userInfoIsPresent) {
    return <GenericSpinner />;
  }

  return (
    <div className={styles.settings}>
      <GeneralSettings />
      {(serverInfo?.googleCalendarIsSupported ||
          serverInfo?.microsoftCalendarIsSupported ||
          serverInfo?.nummaritiliCalendarIsSupported) ? <LinkedAccounts serverInfo={serverInfo} /> : <></>}
      <NotificationSettings />
      <AccountSettings />
    </div>
  );
};

function GeneralSettings() {
  const {data: userInfo} = useGetSelfInfoIfTokenIsPresent();
  assert(userInfo !== undefined);
  const [editUser, {isSuccess, isLoading, error, reset}] = useEditUserMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userInfo.name);
  const {showToast} = useToast();
  const onCancelClick = useCallback(() => {
    setIsEditing(false);
    reset();
    setName(userInfo.name);
  }, [reset, userInfo.name]);
  useEffect(() => {
    if (isSuccess) {
      showToast({
        msg: 'Uusi nimi tallennettu',
        msgType: 'success',
        autoClose: true,
      });
    }
  }, [isSuccess, showToast]);
  useEffect(() => {
    if (isSuccess) {
      onCancelClick();
    }
  }, [isSuccess, onCancelClick]);
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (ev) => {
    ev.preventDefault();
    editUser({name});
  };
  return (
    <div>
      <h4>Yleiset asetukset</h4>
      <div className="mt-4 d-flex align-items-center">
        <h5 className="text-primary mt-2">
          {isEditing ? <label htmlFor="edit-name-input">Muokkaa nimi</label> : 'Nimi'}
        </h5>
        {
          isEditing ? (
            <>
              <button
                type="button"
                className="btn btn-outline-secondary ms-auto custom-btn-min-width"
                onClick={onCancelClick}
                disabled={isLoading}
              >
                Peruuta
              </button>
              <ButtonWithSpinner
                type="submit"
                form="edit-name-form"
                className="btn btn-primary ms-4"
                isLoading={isLoading}
              >
                Tallenna
              </ButtonWithSpinner>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline-primary ms-auto custom-btn-min-width"
              onClick={() => setIsEditing(true)}
            >
              Muokkaa
            </button>
          )
        }
      </div>
      {error && (
        <p className="text-danger text-center mb-0 mt-2">Tapahtui virhe: {getReqErrorMessage(error)}</p>
      )}
      {isEditing ? (
        <Form className="mt-3" id="edit-name-form" onSubmit={onSubmit}>
          <Form.Control
            onChange={(ev) => setName(ev.target.value)}
            value={name}
            autoFocus
            id="edit-name-input"
          />
        </Form>
      ) : (
        <div className="mt-3">
          <span>{userInfo.name}</span>
        </div>
      )}
    </div>
  )
}

function LinkedAccounts({serverInfo}: {serverInfo: ServerInfoResponse|undefined}) {
  const {data: userInfo} = useGetSelfInfoIfTokenIsPresent();
  assert(userInfo !== undefined);
  return (
    <div>
      <h4>Linkitetyt tilit</h4>
      {serverInfo?.nummaritiliCalendarIsSupported ? <LinkedAccount
          provider="nummaritili"
          title={"nummaritili"}
          hasLinkedAccount={userInfo.hasLinkedGoogleAccount}
          useLinkCalendarMutation={useLinkGoogleCalendarMutation}
          useUnlinkCalendarMutation={useUnlinkGoogleCalendarMutation}
      /> : <></>}

      {serverInfo?.microsoftCalendarIsSupported ? <LinkedAccount
        provider="microsoft"
        hasLinkedAccount={userInfo.hasLinkedMicrosoftAccount}
        useLinkCalendarMutation={useLinkMicrosoftCalendarMutation}
        useUnlinkCalendarMutation={useUnlinkMicrosoftCalendarMutation}
      /> : <></>}

      {serverInfo?.googleCalendarIsSupported ? <LinkedAccount
          provider="google"
          hasLinkedAccount={userInfo.hasLinkedExternalGoogleAccount}
          useLinkCalendarMutation={useLinkExternalGoogleCalendarMutation}
          useUnlinkCalendarMutation={useUnlinkExternalGoogleCalendarMutation}
      /> : <></>}
    </div>
  );
}

function LinkedAccount({
  provider,
    title,
  hasLinkedAccount,
  useLinkCalendarMutation,
  useUnlinkCalendarMutation,
}: {
  provider: OAuth2Provider,
  title?: string,
  hasLinkedAccount: boolean,
  useLinkCalendarMutation: typeof useLinkGoogleCalendarMutation,
  useUnlinkCalendarMutation: typeof useUnlinkGoogleCalendarMutation,
}) {
  const [unlinkedAccount, setUnlinkedAccount] = useState(false);
  const [
    unlinkCalendar,
    {
      isSuccess: unlink_isSuccess,
      isLoading: unlink_isLoading,
      error: unlink_error
    }
  ] = useMutationWithPersistentError(useUnlinkCalendarMutation);
  const [
    linkCalendar,
    {
      data: link_data,
      isSuccess: link_isSuccess,
      isLoading: link_isLoading,
      error: link_error
    }
  ] = useMutationWithPersistentError(useLinkCalendarMutation);
  const {showToast} = useToast();
  const capitalizedProvider = capitalize(title ?? provider+' tili');
  useEffect(() => {
    if (unlink_isSuccess) {
      showToast({
        msg: `Poistettu ${capitalizedProvider}`,
        msgType: 'success',
        autoClose: true,
      });
      setUnlinkedAccount(true);
    }
  }, [unlink_isSuccess, showToast, capitalizedProvider]);
  useEffect(() => {
    if (link_isSuccess) {
      window.location.href = link_data!.redirect;
    }
  }, [link_data, link_isSuccess]);
  const calendarProductName = calendarProductNames[provider] ?? capitalizedProvider;
  const buttonVariant = !unlinkedAccount && hasLinkedAccount ? 'secondary' : 'primary';
  let onClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
  if (hasLinkedAccount && !unlinkedAccount) {
    onClick = () => unlinkCalendar();
  } else {
    onClick = () => linkCalendar({
      post_redirect: window.location.pathname
    });
  }
  const error = link_error || unlink_error;
  const btnDisabled = link_isLoading || link_isSuccess || unlink_isLoading;
  return (
    <div className="mt-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between">
        <h5 className="text-primary">{capitalizedProvider}</h5>
        <ButtonWithSpinner
          as="NonFocusButton"
          style={{minWidth: 'max-content'}}
          className={`btn btn-outline-${buttonVariant} w-100-md-down mt-3 mt-md-0`}
          onClick={onClick}
          isLoading={btnDisabled}
        >
          {(hasLinkedAccount && !unlinkedAccount) ? 'Katkaise' : 'Yhdistä'} {calendarProductName} kalenteri
        </ButtonWithSpinner>
      </div>
      {error && (
        <p className="text-danger text-center mb-0 mt-3">Tapahtui virhe: {getReqErrorMessage(error)}</p>
      )}
      <p className="mt-4">
        Linkitä sinun {capitalizedProvider} nähdääksesi {calendarProductName} kalenterin tapahtumia
        kun valitset omia vapaita aikoja.
      </p>
      <small>
        {capitalizedProvider}n profiilitiedot käytetään vain kalenteritapahtumien lukemiseen, muokkaamiseen
        sekä lisäämiseen.
      </small>
    </div>
  );
}

function NotificationSettings() {
  const {data: userInfo} = useGetSelfInfoIfTokenIsPresent();
  assert(userInfo !== undefined);
  const isSubscribed = userInfo.isSubscribedToNotifications;
  // The ref is used to avoid running the useEffect hook twice upon a
  // successful request
  const isSubscribedRef = useRef(isSubscribed);
  const [editUser, {isSuccess, isLoading, error}] = useMutationWithPersistentError(useEditUserMutation);
  const {showToast} = useToast();
  useEffect(() => {
    if (isSuccess) {
      showToast({
        msg: (
          isSubscribedRef.current
            ? 'Peruttu ilmoitusten tilaus'
            : 'Ilmoitukset tilattu 😏'
        ),
        msgType: 'success',
        autoClose: true,
      });
      isSubscribedRef.current = !isSubscribedRef.current;
    }
  }, [isSuccess, showToast]);
  const onClick = () => editUser({
    subscribe_to_notifications: !isSubscribed
  });
  return (
    <div>
      <h4>Ilmoitusasetukset</h4>
      <div className="mt-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between">
          <h5 className="text-primary">Sähköposti-ilmoitukset</h5>
          <ButtonWithSpinner
            as="NonFocusButton"
            style={{minWidth: 'max-content'}}
            className="btn btn-outline-primary w-100-md-down mt-3 mt-md-0"
            onClick={onClick}
            isLoading={isLoading}
          >
            {isSubscribed ? 'Poista ilmoitukset käytöstä' : 'Ota ilmoitukset käyttöön'}
          </ButtonWithSpinner>
        </div>
        {error && (
          <p className="text-danger text-center mb-0 mt-3">Tapahtui virhe: {getReqErrorMessage(error)}</p>
        )}
        <p className="mt-3">
          {
            isSubscribed
              ? 'Sinulle ilmoitetaan tapaamisien ajankohdista ja muista päivityksistä.'
              : 'Sinulle ei ilmoiteta tapaamisien ajankohdista ja muista päivityksistä..'
          }
        </p>
      </div>
    </div>
  );
}

function AccountSettings() {
  const [showModal, setShowModal] = useState(false);
  const onDeleteClick = () => setShowModal(true);
  const [signout, {isLoading, error}] = useMutationWithPersistentError(useLogoutMutation);
  const onSignoutClick = () => signout(true);
  return (
    <div>
      <h4>Tilin asetukset</h4>
      <div className="mt-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between">
          <h5 className="text-primary">Kirjaudu ulos kaikilta laitteilta</h5>
          <ButtonWithSpinner
            as="NonFocusButton"
            className="btn btn-outline-primary custom-btn-min-width w-100-md-down mt-3 mt-md-0"
            onClick={onSignoutClick}
            isLoading={isLoading}
          >
            Kirjaudu ulos
          </ButtonWithSpinner>
        </div>
        {error && (
          <p className="text-danger text-center mt-3">An error occurred: {getReqErrorMessage(error)}</p>
        )}
        <p className="mt-3">
          Tämä kirjaa kaikki kirjautuneena olleet laitteet. Kaikki kirjautumiset tuhotaan.
        </p>
      </div>
      <div className="mt-5">
        <div className="d-flex flex-wrap align-items-center justify-content-between">
          <h5 className="text-primary">Poista tili</h5>
          <NonFocusButton
            type="button"
            className="btn btn-outline-danger custom-btn-min-width w-100-md-down mt-3 mt-md-0"
            onClick={onDeleteClick}
          >
            Poista
          </NonFocusButton>
        </div>
        <p className="mt-3">
          Tämä poistaa pysyvästi tilisi, tapaamisesi sekä tapaamisien osallistujat ja muut tiedot.
        </p>
      </div>
      <DeleteAccountModal show={showModal} setShow={setShowModal} />
    </div>
  );
}
