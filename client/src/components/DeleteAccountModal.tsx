import { useEffect } from "react";
import { useAppDispatch } from "app/hooks";
import ConfirmationModal from "components/ConfirmationModal";
import { useToast } from "components/Toast";
import { useDeleteUserMutation } from "slices/api";
import { useMutationWithPersistentError } from "utils/requests.utils";

export default function DeleteAccountModal({
  show, setShow
}: {
  show: boolean, setShow: (val: boolean) => void
}) {
  const [deleteAccount, {isSuccess, isLoading, error, reset}] = useMutationWithPersistentError(useDeleteUserMutation);
  const dispatch = useAppDispatch();
  const {showToast} = useToast();
  const onDeleteClick = () => deleteAccount();

  useEffect(() => {
    if (isSuccess) {
      showToast({
        msg: 'Tili poistettu',
        msgType: 'success',
        autoClose: true,
      });
      // The user will automatically get redirected to the homepage when the
      // userInfo is deleted from the Redux store (see Settings.tsx)
    }
  }, [isSuccess, showToast, dispatch]);

  return (
    <ConfirmationModal
      show={show}
      setShow={setShow}
      onConfirm={onDeleteClick}
      title="Poista tili?"
      bodyText="Haluatko poistaa tilisi? 😢 Tietosi häviävät tämän jälkeen."
      confirmationButtonText="Poista"
      isLoading={isLoading}
      error={error}
      reset={reset}
    />
  );
};
