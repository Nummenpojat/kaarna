import React, { useState, useEffect, useMemo, useRef } from 'react';
import BottomOverlay from 'components/BottomOverlay';
import {
  selectSelMode,
  resetSelection,
  useEditSelf,
  useEditSelectedUser,
  createSchedule,
  selectSelectedTimes,
} from 'slices/availabilitiesSelection';

import {selectSelectedDates} from 'slices/selectedDates';
import { useAppSelector, useAppDispatch } from 'app/hooks';
import SubmitAsGuestModal from './SubmitAsGuestModal';
import { useToast } from 'components/Toast';
import { assert, assertIsNever, scrollUpIntoViewIfNeeded } from 'utils/misc.utils';
import {addMinutesToDateTimeString, daysOfWeek, getLongerMonthAbbr, getMonthAbbr, months} from 'utils/dates.utils';
import ButtonWithSpinner from 'components/ButtonWithSpinner';
import { useGetCurrentMeetingWithSelector } from 'utils/meetings.hooks';
import { selectTokenIsPresent } from 'slices/authentication';
import { usePutSelfRespondentMutation, useScheduleMeetingMutation, useUnscheduleMeetingMutation, useUpdateAvailabilitiesMutation } from 'slices/api';
import { getReqErrorMessage } from 'utils/requests.utils';
import { selectCurrentMeetingID } from 'slices/currentMeeting';
import InfoModal from 'components/InfoModal';
import NonFocusButton from 'components/NonFocusButton';
import DeleteRespondentModal from './DeleteRespondentModal';

function AvailabilitiesRow({
  moreDaysToRight,
  pageDispatch,
}: {
  moreDaysToRight: boolean,
  pageDispatch: React.Dispatch<'inc' | 'dec'>,
}) {
  const selMode = useAppSelector(selectSelMode);
  const selectedTimes = useAppSelector(selectSelectedTimes);
  const selectedDates = useAppSelector(selectSelectedDates);
  const meetingID = useAppSelector(selectCurrentMeetingID);
  const {respondents, selfRespondentID, scheduledStartDateTime, scheduledEndDateTime, allowGuests, datesOnly} = useGetCurrentMeetingWithSelector(
    ({data: meeting}) => ({
      respondents: meeting?.respondents,
      selfRespondentID: meeting?.selfRespondentID,
      scheduledStartDateTime: meeting?.scheduledStartDateTime,
      scheduledEndDateTime: meeting?.scheduledEndDateTime,
      allowGuests: meeting?.allowGuests,
      datesOnly: meeting?.datesOnly
    })
  );
  assert(meetingID !== undefined && respondents !== undefined);
  // The ref is necessary to avoid showing the toast twice when submitting availabilities
  // for the user who is currently logged in for the first time
  const selfRespondentIDRef = useRef(selfRespondentID);
  const isScheduled = scheduledStartDateTime !== undefined && scheduledEndDateTime !== undefined;
  const scheduledDateTimeTitle = useMemo(() => {
    if (scheduledStartDateTime === undefined || scheduledEndDateTime === undefined) {
      return null;
    }
    return createTitleWithSchedule(scheduledStartDateTime, scheduledEndDateTime);
  }, [scheduledStartDateTime, scheduledEndDateTime]);
  // optimistic - assume that if token is present, user info will be successfully fetched
  const isLoggedIn = useAppSelector(selectTokenIsPresent);
  const editSelf = useEditSelf(isLoggedIn);
  const editSelectedUser = useEditSelectedUser();
  // submitSelf is ONLY used for adding or updating one's availabilities when logged in
  const [
    submitSelf,
    {isSuccess: submitSelf_isSuccess, isLoading: submitSelf_isLoading, error: submitSelf_error, reset: submitSelf_reset}
  ] = usePutSelfRespondentMutation();
  // updateRespondent is used for updating some existing respondent, who may be the current
  // user who is logged in
  const [
    updateRespondent,
    {isSuccess: updateRespondent_isSuccess, isLoading: updateRespondent_isLoading, error: updateRespondent_error, reset: updateRespondent_reset}
  ] = useUpdateAvailabilitiesMutation();

  const [
    schedule,
    {isSuccess: schedule_isSuccess, isLoading: schedule_isLoading, error: schedule_error, reset: schedule_reset}
  ] = useScheduleMeetingMutation();
  const [
    unschedule,
    {isSuccess: unschedule_isSuccess, isLoading: unschedule_isLoading, error: unschedule_error, reset: unschedule_reset}
  ] = useUnscheduleMeetingMutation();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMustBeLoggedInModal, setShowMustBeLoggedInModal] = useState(false);
  const [showDeleteRespondentModal, setShowDeleteRespondentModal] = useState(false);
  const errorMessageElemRef = useRef<HTMLParagraphElement>(null);
  let title = datesOnly ? 'Kalenteri' : 'Aikataulu';
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  // A ref is necessary to avoid running the useEffect hooks (which show the
  // toast messages) twice
  const selectedUserNameRef = useRef<string | null>(null);

  if (scheduledDateTimeTitle !== null) {
    title = scheduledDateTimeTitle;
  }

  useEffect(() => {
    if (submitSelf_isSuccess) {
      const verb = selfRespondentIDRef.current === undefined ? 'Tallennettu' : 'Päiivtetty';
      showToast({
        msg: datesOnly ? `${verb} sopivat päivät` : `${verb} sopivat ajat`,
        msgType: 'success',
        autoClose: true,
      });
      dispatch(resetSelection());
    }
  }, [submitSelf_isSuccess, showToast, dispatch]);

  // Make sure this runs AFTER the hook which shows the toast, above
  useEffect(() => {
    selfRespondentIDRef.current = selfRespondentID;
  }, [selfRespondentID]);

  useEffect(() => {
    if (updateRespondent_isSuccess) {
      dispatch(resetSelection());
    }
  }, [updateRespondent_isSuccess, dispatch])

  useEffect(() => {
    if (schedule_isSuccess) {
      dispatch(resetSelection());
    }
  }, [schedule_isSuccess, dispatch]);

  useEffect(() => {
    if (unschedule_isSuccess) {
      dispatch(resetSelection());
    }
  }, [unschedule_isSuccess, dispatch]);

  useEffect(() => {
    if (selMode.type === 'selectedUser') {
      selectedUserNameRef.current = respondents[selMode.selectedRespondentID].name;
    } else if (selMode.type === 'editingRespondent') {
      selectedUserNameRef.current = respondents[selMode.respondentID].name;
    } else {
      selectedUserNameRef.current = null;
    }
    // FIXME: this feels wrong
    setSelectedUserName(selectedUserNameRef.current);
  }, [selMode, respondents]);

  const clearErrors = () => {
    if (submitSelf_error) submitSelf_reset();
    if (updateRespondent_error) updateRespondent_reset();
    if (schedule_error) schedule_reset();
    if (unschedule_error) unschedule_reset();
  };
  const error = submitSelf_error || updateRespondent_error || schedule_error || unschedule_error;

  useEffect(() => {
    if (error) {
      scrollUpIntoViewIfNeeded(errorMessageElemRef.current!, 48);
    }
  }, [error]);

  const btnDisabled = submitSelf_isLoading || updateRespondent_isLoading || schedule_isLoading || unschedule_isLoading;
  let rightBtnText: string | undefined;
  let onRightBtnClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
  let rightBtn_isLoading = false;
  if (selMode.type === 'none') {
    if (selfRespondentID !== undefined) {
      rightBtnText = 'Muokkaa sopivia '+(datesOnly ? 'päiviä' : 'aikoja');
    } else {
      rightBtnText = 'Lisää sopiva '+(datesOnly ? 'päivä' : 'aika');
    }
    onRightBtnClick = () => {
      if (!isLoggedIn && !allowGuests) {
        setShowMustBeLoggedInModal(true);
        return
      }
      editSelf();
    }
  } else if (selMode.type === 'addingRespondent') {
    title = 'Lisää sinulle sopivat '+(datesOnly ? 'päivät' : 'ajat');
    rightBtnText = 'Jatka';
    if (moreDaysToRight) {
      onRightBtnClick = () => pageDispatch('inc');
    } else {
      if (isLoggedIn) {
        onRightBtnClick = () => {
          submitSelf({
            id: meetingID,
            putRespondentDto: {
              availabilities: Object.keys(selectedDates ? {} : selectedTimes),
              dayAvailabilities: Object.keys(selectedDates)
            },
          });
        };
        rightBtn_isLoading = submitSelf_isLoading;
      } else {
        onRightBtnClick = () => setShowGuestModal(true);
      }
    }
  } else if (selMode.type === 'editingRespondent') {
    if (selfRespondentID === selMode.respondentID) {
      title = 'Muokkaa sinun sopivia aikoja';
    } else {
      title = `Muokkaa käyttäjän ${selectedUserName} sopivia aikoja`;
    }
    rightBtnText = 'Seuraava';
    if (moreDaysToRight) {
      onRightBtnClick = () => pageDispatch('inc');
    } else {
      onRightBtnClick = () => {
        updateRespondent({
          id: meetingID,
          respondentId: selMode.respondentID,
          putRespondentDto: {
            availabilities: Object.keys(selectedDates ? {} : selectedTimes),
            dayAvailabilities: Object.keys(selectedDates)
          },
        });
      };
      rightBtn_isLoading = updateRespondent_isLoading;
    }
  } else if (selMode.type === 'editingSchedule') {
    title = 'Päätä ajankohta tapaamiselle';
    rightBtnText = 'Tallenna';
    onRightBtnClick = () => {
      // TODO handle datesOnly
      if (datesOnly) {
        const selectedDatesFlat = Object.keys(selectedDates).sort();
        if (selectedDatesFlat.length !== 1) {
          setShowInfoModal(true);
          return;
        }
        schedule({
          id: meetingID,
          scheduleMeetingDto: {
            startDateTime: addMinutesToDateTimeString(selectedDatesFlat[0], 0),
            endDateTime: addMinutesToDateTimeString(selectedDatesFlat[0], 0),
          }
        });
      } else {
        const selectedTimesFlat = Object.keys(selectedTimes).sort();
        if (selectedTimesFlat.length === 0) {
          setShowInfoModal(true);
          return;
        }
        schedule({
          id: meetingID,
          scheduleMeetingDto: {
            startDateTime: selectedTimesFlat[0],
            endDateTime: addMinutesToDateTimeString(selectedTimesFlat[selectedTimesFlat.length - 1], 30),
          }
        });
      }
    };
    rightBtn_isLoading = schedule_isLoading;
  } else if (selMode.type === 'selectedUser') {
    if (selfRespondentID === selMode.selectedRespondentID) {
      title = 'Sinulle sopivat '+(datesOnly ? 'päivät' : 'ajat');
      rightBtnText = 'Muokkaa aikoja';
    } else {
      title = `${selectedUserName}:lle sopivat `+(datesOnly ? 'päivät' : 'ajat');
      rightBtnText = `Muokkaa ${selectedUserName}:n `+(datesOnly ? 'päivät' : 'ajat');
    }
    onRightBtnClick = () => editSelectedUser();
  } else {
    // Make sure that we caught all the cases
    assertIsNever(selMode);
  }

  let leftBtnText: string | undefined;
  let onLeftBtnClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
  let leftBtn_isLoading = false;
  if (selMode.type === 'none') {
    if (isScheduled) {
      leftBtnText = 'Peru ajankohta';
      onLeftBtnClick = () => {
        unschedule(meetingID);
      };
      leftBtn_isLoading = unschedule_isLoading;
    } else {
      // TODO: only show Schedule button if there is at least one respondent
      leftBtnText = 'Päätä tapaamisen ajankohta';
      if (respondents && Object.keys(respondents).length > 0 && isLoggedIn) {
        onLeftBtnClick = () => dispatch(createSchedule());
      }
    }
  } else {
    leftBtnText = 'Peruuta';
    onLeftBtnClick = () => {
      dispatch(resetSelection());
      // Don't show the error if the user pressed Cancel
      clearErrors();
    };
  }

  const onDeleteBtnClick =
    selMode.type === 'editingRespondent'
    ? () => setShowDeleteRespondentModal(true)
    : undefined;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between">
        <div style={{fontSize: '1.3em'}}>{title}</div>
        <div className="d-none d-md-flex">
          {onDeleteBtnClick && (
            <NonFocusButton
              className="btn btn-outline-danger me-4 meeting-avl-button"
              onClick={onDeleteBtnClick}
              disabled={btnDisabled}
            >
              Poista
            </NonFocusButton>
          )}
          {onLeftBtnClick && (
            <ButtonWithSpinner
              as="NonFocusButton"
              className="btn btn-outline-secondary meeting-avl-button"
              onClick={onLeftBtnClick}
              disabled={btnDisabled}
              isLoading={leftBtn_isLoading}
            >
              {leftBtnText}
            </ButtonWithSpinner>
          )}
          <ButtonWithSpinner
            as="NonFocusButton"
            className="btn btn-primary ms-4 meeting-avl-button"
            onClick={onRightBtnClick}
            disabled={btnDisabled}
            isLoading={rightBtn_isLoading}
          >
            {rightBtnText}
          </ButtonWithSpinner>
        </div>
      </div>
      <BottomOverlay>
        {onDeleteBtnClick && (
          <NonFocusButton
            className="btn btn-outline-light me-2 meeting-avl-button"
            onClick={onDeleteBtnClick}
            disabled={btnDisabled}
          >
            Poista
          </NonFocusButton>
        )}
        {leftBtnText && (
          <ButtonWithSpinner
            as="NonFocusButton"
            className="btn btn-outline-light meeting-avl-button"
            onClick={onLeftBtnClick}
            disabled={btnDisabled}
            isLoading={leftBtn_isLoading}
          >
            {leftBtnText}
          </ButtonWithSpinner>
        )}
        <ButtonWithSpinner
          as="NonFocusButton"
          className="btn btn-light ms-auto meeting-avl-button"
          onClick={onRightBtnClick}
          disabled={btnDisabled}
          isLoading={rightBtn_isLoading}
        >
          {rightBtnText}
        </ButtonWithSpinner>
      </BottomOverlay>
      {error && (
        <p
          className="text-danger text-center mb-0 mt-3"
          ref={errorMessageElemRef}
        >
          Tapahtui virhe: {getReqErrorMessage(error)}
        </p>
      )}
      <SubmitAsGuestModal show={showGuestModal} setShow={setShowGuestModal} datesOnly={datesOnly ?? false} />
      <InfoModal show={showInfoModal} setShow={setShowInfoModal}>
        <p className="text-center my-3">Vähintään yksi {datesOnly ? 'päivä' : 'aika'} on valittava.</p>
      </InfoModal>
      <InfoModal show={showMustBeLoggedInModal} setShow={setShowMustBeLoggedInModal}>
        <p className="text-center my-3">Sinun on ensin kirjauduttava sisään ilmoittautumista varten</p>
      </InfoModal>
      <DeleteRespondentModal
        show={showDeleteRespondentModal}
        setShow={setShowDeleteRespondentModal}
        respondentID={selMode.type === 'editingRespondent' ? selMode.respondentID : 0}
      />
    </>
  );
}
export default React.memo(AvailabilitiesRow);

/**
 * Generates a title of the form e.g. "Sat, Sep 24 from 9:00AM - 10:00AM"
 * @param startDateTime YYYY-MM-DDTHH:mm:ssZ
 * @param endDateTime YYYY-MM-DDTHH:mm:ssZ
 */
function createTitleWithSchedule(startDateTime: string, endDateTime: string): string {
  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);
  const dayOfWeek = daysOfWeek[startDate.getDay()].substring(0, 2);
  const month = getLongerMonthAbbr(startDate.getMonth());
  const day = startDate.getDate();
  const startTime = startDate.getHours() + ':' + String(startDate.getMinutes()).padStart(2, '0');
  const endTime = endDate.getHours() + ':' + String(endDate.getMinutes()).padStart(2, '0');
  if (startDateTime === endDateTime) {
    return `${dayOfWeek}, ${day}. ${month}`;
  }
  return `${dayOfWeek}, ${day}. ${month} klo ${startTime} - ${endTime}`;
}
