export default function VerifyEmailAddress({email}: {email: string}) {
  return (
    <div className="align-self-center" style={{maxWidth: '600px'}}>
      <h3>Tilin vahvistus</h3>
      <hr className="my-4" />
      <p>
        Varmistussähköposti lähetettiin osoitteeseen <strong>{email}</strong>.
      </p>
      <p>
        Tarkistathan roskapostin jos viestiä ei tule muutaman minuutin kuluttua.
      </p>
    </div>
  );
}
