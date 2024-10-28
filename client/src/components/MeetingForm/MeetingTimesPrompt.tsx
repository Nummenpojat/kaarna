import { useEffect, useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { to12HourClock, tzAbbr } from 'utils/dates.utils';
import { range } from 'utils/arrays.utils';

// startTime and endTime use a 24-hour clock [0, 23]
export default function MeetingTimesPrompt({
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}: {
  startTime: number,
  setStartTime: (time: number) => void,
  endTime: number,
  setEndTime: (time: number) => void,
}) {
  return (
    <fieldset className="create-meeting-form-group">
      <legend className="create-meeting-question">Minkä aikavälillä haluat järjestää tapahtuman?</legend>
      <div className="d-flex align-items-center">
        <TimePicker
          hour={startTime}
          setHour={setStartTime}
          label="Aikaisin mahdollinen aika"
          popupID="start-time-popup"
        />
        <p className="py-0 px-3 m-0">➡️</p>
        <TimePicker
          hour={endTime}
          setHour={setEndTime}
          label="Myöhäisin mahdollinen aika"
          popupID="end-time-popup"
        />
        <p className="py-0 ps-3 m-0">{tzAbbr}</p>
      </div>
    </fieldset>
  );
}

function TimePicker({
  hour: hour24,  // [0, 23]
  setHour: setHour24,
  label,
  popupID,
}: {
  hour: number,
  setHour: (val: number) => void,
  label: string,
  popupID: string,
}) {
  const [show, setShow] = useState(false);
  const inputOrPickerClicked = useRef(false);
  useEffect(() => {
    const listener = () => {
      if (inputOrPickerClicked.current) {
        // Click happened inside of the input or picker
        // Open the picker or keep it open
        setShow(true);
        inputOrPickerClicked.current = false;
      } else {
        // Click happened outside of the input or picker
        // Close the picker if it was open
        setShow(false);
      }
    };
    document.body.addEventListener('click', listener);
    return () => {
      document.body.removeEventListener('click', listener);
    };
  }, []);
  // Use useRef instead of useState because the setHour12 callback would sometimes
  // use a stale value
  // TODO: support keyboard controls
  return (
    <div className="position-relative">
      <Form.Control
        value={hour24}
        readOnly
        onClick={() => { inputOrPickerClicked.current = true; }}
        role="combobox"
        aria-expanded={show ? 'true' : 'false'}
        aria-label={label}
        aria-haspopup="dialog"
        aria-controls={popupID}
      />
      <div
        // Make the picker grow upwards (via bottom: 0) instead of downwards so that
        // the bottom of the picker isn't touching the bottom of the viewport
        className={"position-absolute bottom-0 start-0 meeting-times-picker" + (show ? '' : ' d-none')}
        onClick={() => { inputOrPickerClicked.current = true; }}
        role="dialog"
        id={popupID}
      >
        <div className="meeting-times-picker-top">{hour24}</div>
        <div className="d-flex">
          {/* TODO: use radio buttons instead (with appearance: none) */}
          <ol
            className="flex-grow-1 meeting-times-picker-left"
            role="listbox"
            aria-label="Pick an hour"
          >
            {range(0, 24).map(i => (
              <li
                key={i}
                className={i === hour24 ? 'selected' : ''}
                onClick={() => setHour24(i)}
                role="option"
                aria-selected={i === hour24}
              >
                {String(i).padStart(2, '0')}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
