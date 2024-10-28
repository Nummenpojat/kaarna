import useSetTitle from "utils/title.hook";

export default function TermsOfService() {
  useSetTitle('Terms of Service');
  return (
    <div className="mx-auto" style={{maxWidth: '600px'}}>
      <h3>Käyttöehdot</h3>
      <hr />
      <p>
          Tämä sivusto tarjoaa nummareille palvelun tapaamisten ajoittamiseen
          yhdessä rekisteröimällä heidän saatavilla olevat ajankohdat. Nummarit voivat valinnaisesti
          luoda tili nähdääkseen luomansa kokoukset..
      </p>
      <p>
        Sivuston kanssa asioimisessa ole hyvä ja jätä tekemättä seuraavat asiat:
      </p>
      <ul>
        <li>Kuormantestiä tälle sivustolle (DoS)</li>
        <li>Luoda jäätäviä määriä tilejä</li>
        <li>Luoda jäätävä määrä tapaamisia</li>
        <li>Luoda jäätävä määrä ilmoittautuneita</li>
        <li>Verkkopyyntöjen nopea lähetys</li>
        <li>
          Yleisesti, älä sörki saakeli, anna olla.
          Elä pasko palveluu niin happily ever after.
        </li>
      </ul>
      <p>Kiitos yhteisymmärryksestä.</p>
    </div>
  );
}
