import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import BottomOverlay from 'components/BottomOverlay';
import MeetingForm from 'components/MeetingForm';
import { selectSelectedDates, setSelectedDates } from 'slices/selectedDates';
import './DayPicker.css';
import Calendar from './Calendar';
import { useTodayString } from 'utils/dates.utils';
import { useState } from 'react';
import useSetTitle from 'utils/title.hook';
import {useGetServerInfoQuery} from "../../slices/api";
import {useSelfInfoIsPresent} from "../../utils/auth.hooks";
import InfoModal from "../InfoModal";

export default function DayPicker() {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [clickedMeetButton, setClickedMeetButton] = useState(false);
  const todayString = useTodayString();
  const {data} = useGetServerInfoQuery();
  const isLoggedIn = useSelfInfoIsPresent();
  const atLeastOneDateSelected = useAppSelector(
    state => Object.keys(selectSelectedDates(state)).length > 0 && data
  );

  useSetTitle();

  useEffect(() => {
    // Select today's date by default
    dispatch(setSelectedDates({[todayString]: true}));
  }, [dispatch, todayString]);

  useEffect(() => {
    if (pathname === '/create' && !clickedMeetButton) {
      // user navigated directly to /create without visiting the homepage first
      navigate('/');
    }
  }, [pathname, clickedMeetButton, navigate]);

  if (clickedMeetButton && pathname === '/create') {
    return <MeetingForm />;
  }

  const onClick = () => {
    if (!isLoggedIn && (data && !data["publicCreationEnabled"])) {
      navigate('/login')
      return
    }
    setClickedMeetButton(true);
    navigate('/create');
  };
  return (
    <>
      <section className="d-flex align-items-center justify-content-center justify-content-md-between fs-4">
        <p className="mb-0">Minä päivinä haluat järjestää tapaamisen?</p>
        <button
          className="btn btn-primary px-4 d-none d-md-block"
          onClick={onClick}
          disabled={!atLeastOneDateSelected}
        >
          Järjestä
        </button>
      </section>
      <section style={{marginTop: '4rem'}}>
        <Calendar firstVisibleDate={todayString} />
      </section>
      <BottomOverlay>
        <Link to="/how-it-works" className="custom-link custom-link-inverted">Tutoriaali</Link>
        <button
          className="btn btn-light px-4"
          onClick={onClick}
          disabled={!atLeastOneDateSelected}
        >
          Järjestä
        </button>
      </BottomOverlay>
    </>
  );
};
