import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GenericSpinner from 'components/GenericSpinner';
import NonFocusButton from 'components/NonFocusButton';
import WeeklyViewTimePicker from './WeeklyTimeViewPicker';
import './Meeting.css';
import EditMeeting from './EditMeeting';
import { useGetMeetingQuery } from 'slices/enhancedApi';
import { getReqErrorMessage } from 'utils/requests.utils';
import { useGetCurrentMeetingWithSelector } from 'utils/meetings.hooks';
import { useSelfInfoIsPresent } from 'utils/auth.hooks';
import {useAppDispatch, useAppSelector} from 'app/hooks';
import { setCurrentMeetingID } from 'slices/currentMeeting';
import InfoModal from 'components/InfoModal';
import { useToast } from 'components/Toast';
import {resetSelection, selectSelMode} from 'slices/availabilitiesSelection';
import useSetTitle from 'utils/title.hook';
import {isMobile} from 'react-device-detect';
import MonthlyDayPicker from "./MontlyDayPicker/MontlyDayPicker";

export default function Meeting() {
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const dispatch = useAppDispatch();
  const selMode = useAppSelector(selectSelMode);
  const params = useParams();
  const meetingID = params.id;
  const skip = !meetingID;
  const {data, error} = useGetMeetingQuery(meetingID ?? '', {skip});

  useEffect(() => {
    dispatch(setCurrentMeetingID(meetingID));
  }, [dispatch, meetingID]);

  useSetTitle(data?.name);

  useEffect(() => {
    // Reset the datetime selections when this component unmounts so
    // that the selections from one meeting don't carry over to another
    return () => {
      dispatch(resetSelection());
    };
  }, [dispatch]);

  // Wait until the data for the current meeting is ready.
  // Since the setCurrentMeetingID call happens asynchronously, the data for
  // a different meeting might still be loaded because the old meetingID is
  // still present in the Redux store. So we need to check the meetingID.
  const {isReady} = useGetCurrentMeetingWithSelector(
    ({data: meeting}) => ({isReady: meeting && meeting.meetingID === meetingID})
  );

  if (skip) {
    return <p>Tapaamislinkki on väärä tai viallinen.</p>;
  }
  if (error) {
    return (
      <div className="d-flex justify-content-center">
        <p>
          Tapahtui virhe tapaamisen latauksessa:
          <br />
          {getReqErrorMessage(error)}
        </p>
      </div>
    );
  }
  if (!isReady) {
    return <GenericSpinner />;
  }
  if (isEditingMeeting) {
    return <EditMeeting setIsEditing={setIsEditingMeeting} />;
  }
  return (
    <div className="flex-grow-1">
      <MeetingTitleRow setIsEditingMeeting={setIsEditingMeeting} />
      {(!isMobile || selMode.type === 'none') && <MeetingAboutRow />}
      <hr className="my-4 my-md-5"/>
      {!data?.datesOnly && <WeeklyViewTimePicker />}
      {data?.datesOnly && <MonthlyDayPicker tentativeDates={data?.tentativeDates} />}
    </div>
  );
}

const MeetingTitleRow = React.memo(function MeetingTitleRow({
  setIsEditingMeeting,
}: {
  setIsEditingMeeting: (val: boolean) => void,
}) {
  const {name} = useGetCurrentMeetingWithSelector(
    ({data: meeting}) => ({name: meeting?.name})
  );
  const isLoggedIn = useSelfInfoIsPresent();
  const [showMustBeLoggedInModal, setShowMustBeLoggedInModal] = useState(false);
  const [showClipboardFailedModal, setShowClipboardFailedModal] = useState(false);
  const {showToast} = useToast();
  const onClickEditButton = () => {
    if (isLoggedIn) {
      setIsEditingMeeting(true);
    } else {
      setShowMustBeLoggedInModal(true);
    }
  };
  const onClickShareButton = async () => {
    try {
      // Don't include the query parameters, just in case there's something sensitive in there
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
    } catch (err) {
      console.error('Failed to write to clipboard:', err);
      setShowClipboardFailedModal(true);
      return;
    }
    showToast({
      msg: 'Linkki kopioitu leikepöydälle',
      msgType: 'success',
      autoClose: true,
    });
  };
  return (
    <>
      <div className="d-flex align-items-center">
        <h3 className="me-auto text-primary">{name}</h3>
        <NonFocusButton
          className="btn btn-outline-secondary ps-3 ps-md-4 pe-3 d-flex align-items-center"
          onClick={onClickEditButton}
        >
          <span className="me-3 d-none d-md-inline">Muokkaa</span> {<PencilIcon />}
        </NonFocusButton>
        <NonFocusButton
          className="btn btn-outline-primary ms-4 ps-3 ps-md-4 pe-3 d-flex align-items-center"
          onClick={onClickShareButton}
        >
          <span className="me-3 d-none d-md-inline">Jaa</span> {<ShareIcon />}
        </NonFocusButton>
      </div>
      <InfoModal show={showMustBeLoggedInModal} setShow={setShowMustBeLoggedInModal}>
        <p className="text-center my-3">Sinun on ensin kirjauduttava päästääksesi muokkaamaan</p>
      </InfoModal>
      <InfoModal show={showClipboardFailedModal} setShow={setShowClipboardFailedModal}>
        <p className="text-center my-3">Ei voitu kopioida linkkiä :(</p>
      </InfoModal>
    </>
  );
});

const MeetingAboutRow = React.memo(function MeetingAboutRow() {
  const {about} = useGetCurrentMeetingWithSelector(
    ({data: meeting}) => ({about: meeting?.about})
  );
  if (!about) return null;
  return (
    <div style={{marginTop: '1.5em', fontSize: '0.9em'}}>
      {about}
    </div>
  );
});

function PencilIcon() {
  // Adapted from https://icons.getbootstrap.com/icons/pencil/
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pencil" viewBox="0 0 16 16" style={{position: 'relative', top: '0.05em'}}>
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>
  );
}

function ShareIcon() {
  // Copied from https://icons.getbootstrap.com/icons/share/
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-share" viewBox="0 0 16 16" style={{position: 'relative', top: '0.1em'}}>
      <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
    </svg>
  );
}
