import SelectedDatesPicture from 'assets/help-section-selected-dates.png';
import SelectedTimesPicture from 'assets/help-section-selected-times.png';
import DateCheckmarkPicture from 'assets/help-section-date-checkmark.png';
import styles from './HowItWorksPage.module.css';
import { Link } from 'react-router-dom';
import useSetTitle from 'utils/title.hook';

export default function HowItWorksPage() {
  useSetTitle('Tutoriaali');
  return (
    <>
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="mb-0 page-title">Kuinka tämä toimii</h3>
        <Link to="/">
          <button className="btn btn-outline-primary px-4">Kokeile nyt!</button>
        </Link>
      </div>
      <InstructionStep
        stepNumber={1}
        title={"Valitse päivät jolloin haluat tavata"}
        body={"Valitse yksi tai monta päivämäärää jolloin haluaisit tavata ryhmässä."}
        image={SelectedDatesPicture}
      />
      <InstructionStep
        stepNumber={2}
        title={"Valitse ajat jolloin olet itse vapaana."}
        body={"Valitse päivämäärien kohdalla ajat kun sinulle sopii tavata."}
        image={SelectedTimesPicture}
      />
      <InstructionStep
        stepNumber={3}
        title={"Valitse aika joka sopii kaikille."}
        body={
            "Jaa kokouslinkki ryhmällesi, niin he valitsevat itsellensä sopivat ajat." +
            " Kaikkien saatavuustiedot sijoitetaan samaan ruudukkoon, " +
            "josta löydät helposti kaikille sopivan ajankohdan."
        }
        image={DateCheckmarkPicture}
      />
    </>
  );
}

function InstructionStep({
  stepNumber,
  title,
  body,
  image,
}: {
  stepNumber: number,
  title: string,
  body: string,
  image: string,
}) {
  return (
    <div className={`mt-5 d-flex flex-column flex-md-row align-items-md-center ${styles.helpStepContainer}`}>
      <div>
        <h4 className="text-primary">{stepNumber}&#41; {title}</h4>
        <p className="mt-4">{body}</p>
      </div>
      <div className={styles.imageContainer}>
        <img src={image} alt={title} />
      </div>
    </div>
  );
}
