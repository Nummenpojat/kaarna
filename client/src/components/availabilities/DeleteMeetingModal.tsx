import { useEffect } from "react";
import { useAppSelector } from "app/hooks";
import ConfirmationModal from "components/ConfirmationModal";
import { useNavigate } from "react-router-dom";
import { useToast } from "components/Toast";
import { useDeleteMeetingMutation } from "slices/api";
import { useMutationWithPersistentError } from "utils/requests.utils";
import { selectCurrentMeetingID } from "slices/currentMeeting";
import { assert } from "utils/misc.utils";

export default function DeleteMeetingModal({
  show, setShow
}: {
  show: boolean, setShow: (val: boolean) => void,
}) {
  const meetingID = useAppSelector(selectCurrentMeetingID);
  assert(meetingID !== undefined);
  const [deleteMeeting, {isLoading, isSuccess, error, reset}] = useMutationWithPersistentError(useDeleteMeetingMutation);
  const navigate = useNavigate();
  const {showToast} = useToast();
  const onDeleteClick = () => deleteMeeting(meetingID);

  useEffect(() => {
    if (isSuccess) {
      showToast({
        msg: 'Tapaaminen poistettu',
        msgType: 'success',
        autoClose: true,
      });
      navigate('/');
    }
  }, [isSuccess, showToast, navigate]);

  return (
    <ConfirmationModal
      show={show}
      setShow={setShow}
      onConfirm={onDeleteClick}
      title="Poista tapaaminen"
      bodyText="Haluatko poistaa tämän tapaamisen? Se todellakin häviää taivaan tuuliin 🍃"
      confirmationButtonText="Poista"
      isLoading={isLoading}
      error={error}
      reset={reset}
    />
  );
};
