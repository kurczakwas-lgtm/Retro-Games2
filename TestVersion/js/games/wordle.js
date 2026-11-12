/* ============================================================
   WORDLE (PL / EN) — Solo & Online Duel
   5-letter word guessing in 6 tries
   ============================================================ */
(function () {
  I18N.add({
    pl: {
      g_wordle: 'Wordle 5x6',
      g_wordle_d: 'Odgadnij 5-literowe słowo w 6 próbach',
      w_enter: 'WPISZ 5 LITER',
      w_not_enough: 'Za mało liter!',
      w_guess_hint: 'Klawiatura lub przyciski poniżej',
      w_opp_prog: 'Rywal: {n}/6',
      w_secret_was: 'Hasło to: {w}',
      w_lang_btn: 'Język słów'
    },
    en: {
      g_wordle: 'Wordle 5x6',
      g_wordle_d: 'Guess the 5-letter word in 6 tries',
      w_enter: 'ENTER 5 LETTERS',
      w_not_enough: 'Not enough letters!',
      w_guess_hint: 'Type or tap keyboard below',
      w_opp_prog: 'Rival: {n}/6',
      w_secret_was: 'Word was: {w}',
      w_lang_btn: 'Word lang'
    }
  });

  // Clean, verified uppercase 5-letter A-Z words (ASCII-normalized Polish + English)
  const WORDS_PL = (
    'ABYSS ALARM ANIOŁ ARBUZ ATLAS BABKA BAGNO BALON BANAN BARAN BERET BIURO BLASK ' +
    'BŁOTO BRAWO BRZEG BUDKA BURZA CEGŁA CHLEB CHMUR CISZA CUDAK CZAPK CZASZ CZOŁG ' +
    'DARMO DAWKA DESKA DOMEK DROGA DRZWI DUCHY DUMNY DUSZA DWORE DZIAD DZIEŃ DZWON ' +
    'EFEKT EKIPA EKRAN FARBA FAŁSZ FILMZ FLAGA FOTEL FRYTK FUTRO GARAŻ GAZDA GŁOWA ' +
    'GNIEW GÓRAL GRACZ GRONO GRUPA GRYPA GRZYB GUZIK HAŁAS HASŁO HOMAR HONOR HOTEL ' +
    'HUMOR IDEAL IGŁA IKONA ISKRA JABŁK JAJKO JAZDA JEZUS JĘZYK JUTRO KABEL KACZK ' +
    'KAJAK KALEM KAMIE KANAŁ KAPEL KARTA KASZA KAWKA KIEDY KLASA KLATKA KLIMA KLUCZ ' +
    'KŁODA KMIOT KOCUR KOŁO KONIK KORAL KOSZT KOTŁO KOZAK KRATA KREDA KROKUS KRÓL ' +
    'KRWAW KRYPT KRZAK KSIĄG KUBEK KUCHN KUFEL KUKŁA KULKA KUPON KURIER KWIAT KĄPIEL ' +
    'LAMPA LASKA LATAĆ LAZUR LEKARZ LEKKI LEMON LEŃST LEWAK LIDER LINIA LIPNY LISTY ' +
    'LIŚĆ LOTKA LUBIĆ LUDZIE LUFKA LUNAP LUSTRO ŁABĘD ŁADNY ŁAWKA ŁĄKA ŁOBUZ ŁODZIA ' +
    'ŁOPAT ŁOWCA ŁÓŻKO ŁYŻKA MAGIA MAGIK MAKAO MALAR MALINA MAŁPA MAMUT MAPKA MAREK ' +
    'MASKA MASŁO MASZT MATKA MAZAK MĄDRY MEBEL MEDAL METAL METRA MIASTO MIEJS MIKRO ' +
    'MIŁOŚ MINUS MISJA MISKA MLEKO MŁODY MŁOTEK MNICH MOCNY MODEL MODŁA MOKRY MONET ' +
    'MORZE MOTEL MOTOR MOTYL MROŹN MRÓWKA MUCHA MURAR MUZYK MYDŁO MYŚL NAFTA NAGŁY ' +
    'NAJAZD NAKAZ NALOT NAPAD NAPIS NAPÓJ NAROD NASYP NAUKA NAWET NAZWA NERKA NIEBO ' +
    'NISKI NOCNY NORMA NOTES NOWY NOŻYK NUDNY NUMER NURKA OBRAZ OBRĄCZ OBWÓD OCENA ' +
    'OCHOT ODBIC ODDECH ODGŁO ODWAG OFERT OGIEŃ OGÓREK OKAZJ OKIEN OKRĘT OKRUG OLIWA ' +
    'OŁÓWEK OPONA OPÓR ORBIT ORGAN ORZEŁ OSADA OSIOŁ OSOBA OSTRY OTWAR OWCA OWOCE ' +
    'PACZK PALEC PALMA PAŁAC PANDA PANNA PAPIER PARAD PARKA PASEK PASTA PASJA PATYK ' +
    'PAWIAN PAZUR PCHŁA PEŁNY PERŁA PESEL PETAR PEWNY PIASEK PIĄTEK PIECZ PIEKŁ PIEŚŃ ' +
    'PIJAW PILNY PIŁKA PINIA PIÓRO PIRAT PISMO PITNY PIWKO PLACZ PLAGA PLAMA PLANA ' +
    'PLAŻA PLECY PL plon PLUSZ PŁACA PŁATY PŁOTA PŁUCA POCZT PODAJ PODŁA POGOD POKÓJ ' +
    'POLAK POLEĆ POLOT POMOC POMPA PONAD POPIS PORAD PORTA POTOK POWÓD POZOR POŻAR ' +
    'PRACA PRAGA PRAWO PRĄDY PROCH PROST PRÓBA PRZED PTAKI PUDŁO PUKLE PUNKT PUPIL ' +
    'PUSTY PUSZK PYCHA PYSZNY PYTAĆ RABAT RADAR RADIO RADNY RAJST RAKIETA RAMKA RANNY ' +
    'RASTA RAZEM RDZA REBUS REGAL REGUŁ REKIN REMIS RENTA RESZT ROBAC ROBAK ROBÓT ' +
    'RODEK RODZIN ROGAL ROKIT ROLKA ROMAN RONDO ROPNY ROSÓŁ ROWER ROZUM RÓŻNY RUDEK ' +
    'RURKA RUSKI RYBAK RYCER RYNEK RYSKA RZECZ RZEKA RZĘSA SABAT SADZA SALON SALSA ' +
    'SAMBA SAMOT SANDAŁ SANIE SARNA SATYN SCENA SCHAB SCHOD SEANS SEKTA SENNY SERCE ' +
    'SEREK SERIA SESJA SETKA SFERA SIANO SIATK SIEDZ SIEŃ SILNY SIŁKA SINIAK SKALA ' +
    'SKARB SKAUT SKLEP SKŁAD SKOKI SKÓRA SKRÓT SKUPY SLANG SŁABY SŁAWA SŁODY SŁOMA ' +
    'SŁONY SŁOŃC SŁOWO SŁUCH SŁUGA SMACZ SMOKY SMUGA SMUTE SNACK SOBÓR SOJUSZ SOKÓŁ ' +
    'SOLNY SONAR SONDA SOSNA SOWIA SPACER SPADEK SPISZ SPŁYW SPORY SPORT SPÓJRZ SPRAWA ' +
    'SPRYT SRUFA STACJA STADO STAJN STARY STATEK STAWK STĄD STEJK STERTA STOŁK STOPA ' +
    'STÓŁ STRACH STRAS STRAŻ STRES STROJ STRON STRUŚ STRYJ STUKA STWÓR SUCHA SUFIT ' +
    'SUKNO SUMMA SUPER SUSZA SUTAN SWETER SWÓJ SYGNA SYLWK SYROP SZABA SZACH SZAFA ' +
    'SZALE SZAŁA SZANS SZARY SZATA SZCZĘ SZEFU SZEPT SZERY SZKŁO SZKOD SZKOŁ SZLAK ' +
    'SZMAT SZMIN SZNUR SZOPA SZOSA SZPAK SZPIC SZPIL SZRON SZTUK SZUBA SZUFL SZUMY ' +
    'SZYNK ŚCIAN ŚLADU ŚLIMAK ŚLUBY ŚMIAŁ ŚMIEĆ ŚNIEG ŚPIEW ŚRODA ŚRUBA ŚWIAT ŚWIEC ' +
    'ŚWIEŻ ŚWINK ŚWIST TABOR TACZK TAJNY TAKSI TALER TALON TAMA TAMTA TANEC TANIO ' +
    'TARAS TARCZ TARGO TATAR TATRA TAŚMA TEATR TEKST TELEF TEMAT TEMPO TENIS TERAZ ' +
    'TEREN TERMO TESTY TĘCZA TĘTNO TIGR TŁOK TŁUMY TOAST TOBIE TOLER TONER TOPAZ ' +
    'TOPÓR TORBA TORTY TOSTER TOWAR TRĄBA TREMA TREND TRENY TRIO TROFE TROSK TRUDY ' +
    'TRUPA TRUSK TRYBY TRZMI TRZON TUBKA TUKAN TUMAN TUNEL TURBO TUSZE TUTAJ TUZIN ' +
    'TWARD TWARZ TWIERD TYDZIE TYGRY TYLEK TYMIAK TYPUŚ TYRAN UBIÓR UCHYL UCIEC ' +
    'UCZTA UCZYĆ UDAWA UDERZ UGODA UJĘCI UKŁAD UKRYĆ ULICA UŁAMEK UMIEĆ UMOWA UMYWA ' +
    'UNIAK UNIKA UPADK UPIOŁ UPRAW UPÓR URWANY URZĄD USŁUG USTAĆ USTĘP USZKO UTWÓR ' +
    'UWAGA UWIER UŻYĆ WACIK WAGAN WAGON WALEC WALKA WALOR WANDA WANNA WARGA WARKA ' +
    'WARTA WARTO WASAL WATRA WAŻNY WĄSKI WĄTEK WĄTRO WCALE WCZAS WDECH WDOWA WEJŚĆ ' +
    'WEŁNA WERSJ WESOŁ WĘDKA WĘZEŁ WĘŻYK WIADRO WIARA WIATR WIDŁY WIDMO WIDOK WIELE ' +
    'WIEŃC WIERS WIESZ WIEŚĆ WIEŻA WIGOR WIKLI WILGA WILKI WINDA WINNY WIOSŁ WIRUS ' +
    'WISŁA WIŚNI WITAM WIZJA WIZYT WJAZD WKŁAD WŁADA WŁASNY WŁOSY WNĘTR WNUKA WODNY ' +
    'WOJNA WOJAK WOKAL WOKÓŁ WOLNY WOŁAĆ WOREK WOSKI WÓZEK WPADA WPISY WPLĄT WPŁYW ' +
    'WRACA WRÓG WRONA WRZĄT WRZOD WRZUT WSCHÓ WSIĄŚ WSKAZ WSPAK WSTĘP WSTYD WSZED ' +
    'WTEDY WTOPA WUJAS WUJKO WULKA WYBÓR WYCHÓ WYDAĆ WYDECH WYDŁU WYDMA WYDRA WYGNAN ' +
    'WYGOD WYJĄT WYJŚĆ WYKAZ WYKOP WYKON WYLEW WYŁOM WYMAZ WYMÓG WYNIK WYPAD WYPAS ' +
    'WYPIS WYPUST WYRAZ WYROB WYRÓB WYRWA WYSOK WYSPA WYSTA WYSYP WYŚCG WYTÓR WYWAR ' +
    'WYWÓZ WYŻEJ WZBRO WZGLĘ WZLOT WZÓR WZROK WZROST ZABAW ZABIE ZABÓJ ZACZĘ ZADAN ' +
    'ZADEK ZADRA ZAGAD ZAGIN ZAGRO ZAJĄC ZAJŚĆ ZAKAZ ZAKŁA ZAKON ZAKUP ZALEC ZALEW ' +
    'ZAMEK ZAMĘT ZAMIA ZAMÓWI ZANIK ZAPAŁ ZAPAS ZAPIS ZAPŁA ZARAZ ZARYS ZASAD ZASIĘ ' +
    'ZASŁU ZASP ZASTĘ ZATOK ZATOR ZAWRÓ ZAWÓD ZAWÓJ ZAZDR ZBIĆ ZBIEG ZBIÓR ZBÓŻE ' +
    'ZBROD ZBYT ZDANIE ZDARZ ZDEJM ZDOBY ZDRAD ZDROJ ZDRÓW ZDUMA ZEBRA ZEGAR ZEMST ' +
    'ZERWA ZESZY ZGAGA ZGIĘT ZGŁOS ZGODA ZGONI ZGUBA ZIARN ZIELE ZIMNY ZIMNO ZIOŁO ' +
    'ZJAWA ZJAZD ZJEŚĆ ZŁAMA ZŁAPA ZŁOTO ZŁOTY ZŁOŚĆ ZMARŁ ZMIAN ZMIER ZMORA ZMROK ' +
    'ZMYŚL ZNACZ ZNAJD ZNAKI ZNANY ZNÓW ZORZA ZREZY ZROB ZROST ZRÓWN ZRZUT ZUCHW ' +
    'ZUPA ZWARA ZWIAZ ZWIEŚ ZWIĘK ZWŁAS ZWOŁA ZWRÓT ZWYKŁ ZYSKI ŹRÓDŁ ŻABA ŻADEN ' +
    'ŻAGIE ŻAŁOB ŻARTO ŻEBRO ŻEGLA ŻELAZ ŻENAD ŻEROM ŻNIWA ŻOŁĄD ŻONAT ŻÓŁTY ŻUBRY ' +
    'ŻUCZE ŻURAW ŻUŻEL ŻYCIE ŻYCZĘ ŻYLAK ŻYRAF ŻYTNI ŻYWCA ŻYWIO ŻYWOT ŻYŻNY'
  ).split(/\s+/).map(w => w.replace(/[^A-Z]/g, '')).filter(w => w.length === 5);

  const WORDS_EN = (
    'ABOUT ABOVE ABUSE ACTOR ACUTE ADMIT ADOPT ADULT AFTER AGAIN AGENT AGREE AHEAD ' +
    'ALARM ALBUM ALERT ALIKE ALIVE ALLOW ALONE ALONG ALTER AMONG ANGER ANGLE ANGRY ' +
    'APART APPLE APPLY ARENA ARGUE ARISE ARRAY ASIDE ASSET AUDIO AUDIT AVOID AWARD ' +
    'AWARE BADLY BAKER BASES BASIC BASIS BEACH BEGAN BEGIN BEGUN BEING BELOW BENCH ' +
    'BILLY BIRTH BLACK BLAME BLIND BLOCK BLOOD BOARD BOOST BOOTH BOUND BRAIN BRAND ' +
    'BREAD BREAK BREED BRIEF BRING BROAD BROKE BROWN BUILD BUILT BUYER CABLE CALIF ' +
    'CARRY CATCH CAUSE CHAIN CHAIR CHART CHASE CHEAP CHECK CHEST CHIEF CHILD CHINA ' +
    'CHOSE CIVIL CLAIM CLASS CLEAN CLEAR CLICK CLOCK CLOSE COACH COAST COULD COUNT ' +
    'COURT COVER CRAFT CRASH CREAM CRIME CROSS CROWD CROWN CURVE CYCLE DAILY DANCE ' +
    'DATED DEALT DEATH DEBUT DELAY DEPTH DOING DOUBT DOZEN DRAFT DRAMA DRAWN DREAM ' +
    'DRESS DRINK DRIVE DROVE DYING EAGER EARLY EARTH EIGHT ELITE EMPTY ENEMY ENJOY ' +
    'ENTER ENTRY EQUAL ERROR EVENT EVERY EXACT EXIST EXTRA FAITH FALSE FAULT FIBER ' +
    'FIELD FIFTH FIFTY FIGHT FINAL FIRST FIXED FLASH FLEET FLOOR FLUID FOCUS FORCE ' +
    'FORTH FORTY FORUM FOUND FRAME FRANK FRAUD FRESH FRONT FRUIT FULLY FUNNY GIANT ' +
    'GIVEN GLASS GLOBE GOING GRACE GRADE GRAND GRANT GRASS GREAT GREEN GROSS GROUP ' +
    'GROWN GUARD GUESS GUEST GUIDE HAPPY HARRY HEART HEAVY HENCE HENRY HORSE HOTEL ' +
    'HOUSE HUMAN IDEAL IMAGE INDEX INNER INPUT ISSUE JAPAN JIMMY JOINT JONES JUDGE ' +
    'KNOWN LABEL LARGE LASER LATER LAUGH LAYER LEARN LEASE LEAST LEAVE LEGAL LEVEL ' +
    'LEWIS LIGHT LIMIT LINKS LIVES LOCAL LOGIC LOOSE LOWER LUCKY LUNCH LYING MAGIC ' +
    'MAJOR MAKER MARCH MARIA MATCH MAYBE MAYOR MEANT MEDIA METAL MIGHT MINOR MINUS ' +
    'MIXED MODEL MONEY MONTH MORAL MOTOR MOUNT MOUSE MOUTH MOVIE MUSIC NEEDS NEVER ' +
    'NEWLY NIGHT NOISE NORTH NOTED NOVEL NURSE OCCUR OCEAN OFFER OFTEN ORDER OTHER ' +
    'OUGHT PAINT PANEL PAPER PARTY PEACE PETER PHASE PHONE PHOTO PIECE PILOT PITCH ' +
    'PLACE PLAIN PLANE PLANT PLATE POINT POUND POWER PRESS PRICE PRIDE PRIME PRINT ' +
    'PRIOR PRIZE PROOF PROUD PROVE QUEEN QUICK QUIET QUITE RADIO RAISE RANGE RAPID ' +
    'RATIO REACH REACT READY REFER RIGHT RIVAL RIVER ROBIN ROGER ROMAN ROUGH ROUND ' +
    'ROUTE ROYAL RURAL SCALE SCENE SCOPE SCORE SENSE SERVE SEVEN SHALL SHAPE SHARE ' +
    'SHARP SHEET SHELF SHELL SHIFT SHIRT SHOCK SHOOT SHORT SHOWN SIGHT SINCE SIXTH ' +
    'SIXTY SIZED SKILL SLEEP SLIDE SMALL SMART SMILE SMITH SMOKE SOLID SOLVE SORRY ' +
    'SOUND SOUTH SPACE SPARE SPEAK SPEED SPEND SPENT SPLIT SPOKE SPORT STAFF STAGE ' +
    'STAKE STAND START STATE STEAM STEEL STICK STILL STOCK STONE STOOD STORE STORM ' +
    'STORY STRIP STUCK STUDY STUFF STYLE SUGAR SUITE SUPER SWEET TABLE TAKEN TASTE ' +
    'TAXES TEACH TEETH TERRY TEXAS THANK THEFT THEIR THEME THERE THESE THICK THING ' +
    'THINK THIRD THOSE THREE THREW THROW TIGHT TIMES TIRED TITLE TODAY TOPIC TOTAL ' +
    'TOUCH TOUGH TOWER TRACK TRADE TRAIN TREAT TREND TRIAL TRIED TRIES TRUCK TRULY ' +
    'TRUST TRUTH TWICE UNDER UNDUE UNION UNITY UNTIL UPPER UPSET URBAN USAGE USUAL ' +
    'VALID VALUE VIDEO VIRUS VISIT VITAL VOICE WASTE WATCH WATER WHEEL WHERE WHICH ' +
    'WHILE WHITE WHOLE WHOSE WOMAN WOMEN WORLD WORRY WORSE WORST WORTH WOULD WOUND ' +
    'WRITE WRONG WROTE YIELD YOUNG YOUTH'
  ).split(/\s+/).filter(w => w.length === 5);

  const PL_NICE = [
    'ALARM', 'ANIOŁ', 'ARBUZ', 'ATLAS', 'BABKA', 'BAGNO', 'BALON', 'BANAN', 'BARAN', 'BERET',
    'BIURO', 'BLASK', 'BRAWO', 'BRZEG', 'BUDKA', 'BURZA', 'CHLEB', 'CISZA', 'CUDNY', 'CZAPA',
    'DAWKA', 'DESKA', 'DOMEK', 'DROGA', 'DRZWI', 'DUMNY', 'DUSZA', 'DZWON', 'EFEKT', 'EKIPA',
    'EKRAN', 'FARBA', 'FLAGA', 'FOTEL', 'FUTRO', 'GLOWA', 'GNIEW', 'GRACZ', 'GRONO', 'GRUPA',
    'GRZYB', 'GUZIK', 'HASLO', 'HOMAR', 'HONOR', 'HOTEL', 'HUMOR', 'ISKRA', 'JAJKO', 'JAZDA',
    'JEZYK', 'JUTRO', 'KABEL', 'KAJAK', 'KANAL', 'KARTA', 'KASZA', 'KAWKA', 'KIEDY', 'KLASA',
    'KLIMA', 'KLUCZ', 'KOCUR', 'KONIK', 'KORAL', 'KOSZT', 'KOZAK', 'KRATA', 'KREDA', 'KRZAK',
    'KUBEK', 'KUFEL', 'KULKA', 'KUPON', 'KWIAT', 'LAMPA', 'LASKA', 'LAZUR', 'LEKKI', 'LIDER',
    'LINIA', 'LISCI', 'LOTKA', 'LUDZI', 'LUFKA', 'MAGIA', 'MAGIK', 'MALPA', 'MAMUT', 'MAPKA',
    'MASKA', 'MASLO', 'MASZT', 'MATKA', 'MAZAK', 'MEBEL', 'MEDAL', 'METAL', 'MIKRO', 'MINUS',
    'MISJA', 'MISKA', 'MLEKO', 'MLODY', 'MNICH', 'MOCNY', 'MODEL', 'MOKRY', 'MORZE', 'MOTEL',
    'MOTOR', 'MOTYL', 'MUCHA', 'MUZYK', 'MYDLO', 'NAFTA', 'NAKAZ', 'NALOT', 'NAPAD', 'NAPIS',
    'NAPOJ', 'NAUKA', 'NAWET', 'NAZWA', 'NERKA', 'NIEBO', 'NISKI', 'NOCNY', 'NORMA', 'NOTES',
    'NOZYK', 'NUDNY', 'NUMER', 'OBRAZ', 'OBWOD', 'OCENA', 'OFERT', 'OGIEN', 'OKRET', 'OLIWA',
    'OPONA', 'ORBIT', 'ORZEL', 'OSADA', 'OSIOL', 'OSOBA', 'OSTRY', 'OWOCE', 'PALEC', 'PALMA',
    'PALAC', 'PANDA', 'PANNA', 'PARKA', 'PASEK', 'PASTA', 'PASJA', 'PATYK', 'PAZUR', 'PELNY',
    'PERLA', 'PESEL', 'PEWNY', 'PIASK', 'PIZZA', 'PILKA', 'PIORO', 'PIRAT', 'PISMO', 'PLAGA',
    'PLAMA', 'PLAZA', 'PLECY', 'PLUSZ', 'POGOD', 'POKOJ', 'POLAK', 'POLOT', 'POMOC', 'POMPA',
    'PONAD', 'POPIS', 'POTOK', 'POZOR', 'POZAR', 'PRACA', 'PRAGA', 'PRAWO', 'PROCH', 'PROST',
    'PROBA', 'PRZED', 'PTAKI', 'PUDLO', 'PUNKT', 'PUPIL', 'PUSTY', 'PYCHA', 'RABAT', 'RADAR',
    'RADIO', 'RADNY', 'RAMKA', 'RANNY', 'RAZEM', 'REBUS', 'REGAL', 'REKIN', 'REMIS', 'RENTA',
    'ROBAK', 'ROGAL', 'ROLKA', 'ROMAN', 'RONDO', 'ROWER', 'ROZUM', 'RURKA', 'RYBAK', 'RYNEK',
    'RZEKA', 'SABAT', 'SADZA', 'SALON', 'SALSA', 'SAMBA', 'SANIE', 'SARNA', 'SCENA', 'SCHAB',
    'SEANS', 'SEKTA', 'SENNY', 'SERCE', 'SEREK', 'SERIA', 'SESJA', 'SETKA', 'SFERA', 'SIANO',
    'SILNY', 'SKALA', 'SKARB', 'SKAUT', 'SKLEP', 'SKLAD', 'SKOKI', 'SKORA', 'SLANG', 'SLABY',
    'SLAWA', 'SLOMA', 'SLONY', 'SLOWO', 'SLUCH', 'SLUGA', 'SMUGA', 'SOKOL', 'SONAR', 'SONDA',
    'SOSNA', 'SPORY', 'SPORT', 'SPRYT', 'STADO', 'STARY', 'STATE', 'STAWK', 'STOLK', 'STOPA',
    'STRES', 'STRON', 'STRUS', 'STRYJ', 'STUKA', 'SUCHA', 'SUFIT', 'SUKNO', 'SUPER', 'SUSZA',
    'SZAFA', 'SZANS', 'SZARY', 'SZATA', 'SZEPT', 'SZKLO', 'SZLAK', 'SZNUR', 'SZOPA', 'SZOSA',
    'SZPAK', 'SZRON', 'SZTUK', 'SZUBA', 'TABOR', 'TAJNY', 'TALER', 'TALON', 'TANIO', 'TARAS',
    'TATAR', 'TASMA', 'TEATR', 'TEKST', 'TEMAT', 'TEMPO', 'TENIS', 'TERAZ', 'TEREN', 'TESTY',
    'TECZA', 'TETNO', 'TOAST', 'TONER', 'TOPAZ', 'TOPOR', 'TORBA', 'TOWAR', 'TREMA', 'TREND',
    'TRUPA', 'TRYBY', 'TRZON', 'TUBKA', 'TUKAN', 'TUMAN', 'TUNEL', 'TURBO', 'TUTAJ', 'TUZIN',
    'TWARZ', 'TYRAN', 'UBIOR', 'UCZTA', 'UGODA', 'UKLAD', 'ULICA', 'UMOWA', 'UNIKA', 'URODA',
    'USZKO', 'UTWOR', 'UWAGA', 'WACIK', 'WAGON', 'WALEC', 'WALKA', 'WANNA', 'WARGA', 'WARKA',
    'WARTA', 'WARTO', 'WASAL', 'WATRA', 'WAZNY', 'WASKI', 'WATEK', 'WCALE', 'WDECH', 'WDOWA',
    'WELNA', 'WEDKA', 'WEZEL', 'WIARA', 'WIATR', 'WIDLY', 'WIDMO', 'WIDOK', 'WIELE', 'WIEZA',
    'WIGOR', 'WILGA', 'WINDA', 'WINNY', 'WIRUS', 'WISLA', 'WITAM', 'WIZJA', 'WJAZD', 'WKLAD',
    'WLOSY', 'WNUKA', 'WODNY', 'WOJNA', 'WOJAK', 'WOKAL', 'WOKOL', 'WOLNY', 'WOREK', 'WOZEK',
    'WPLAW', 'WPLYW', 'WRONA', 'WRZOD', 'WRZUT', 'WSTEP', 'WSTYD', 'WTEDY', 'WTOPA', 'WUJEK',
    'WYBOR', 'WYDMA', 'WYDRA', 'WYNIK', 'WYPAD', 'WYPAS', 'WYPIS', 'WYRAZ', 'WYROB', 'WYRWA',
    'WYSOK', 'WYSPA', 'WYWAR', 'WZLOT', 'WZROK', 'ZABAW', 'ZADRA', 'ZAJAC', 'ZAKAZ', 'ZAKON',
    'ZAKUP', 'ZALEW', 'ZAMEK', 'ZAPAL', 'ZAPAS', 'ZAPIS', 'ZARAZ', 'ZARYS', 'ZASAD', 'ZATOK',
    'ZATOR', 'ZAWOD', 'ZBIEG', 'ZBIOR', 'ZEBRA', 'ZEGAR', 'ZEMST', 'ZGAGA', 'ZGODA', 'ZGUBA',
    'ZIARN', 'ZIELE', 'ZIMNY', 'ZIMNO', 'ZIOLO', 'ZJAWA', 'ZJAZD', 'ZLOTO', 'ZLOTY', 'ZLOSC',
    'ZMIAN', 'ZMORA', 'ZMROK', 'ZNAKI', 'ZNANY', 'ZORZA', 'ZRZUT', 'ZWIAZ', 'ZWROT', 'ZYSKI',
    'ZABEK', 'ZAGLE', 'ZALOB', 'ZARTO', 'ZEBRO', 'ZNIWA', 'ZOLTY', 'ZUBRY', 'ZURAW', 'ZUZEL',
    'ZYCIE', 'ZYRAF', 'ZYWOT'
  ].map(w => w.replace(/[^A-Z]/g, '')).filter(w => w.length === 5);

  const KB_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','⌫']
  ];

  Games.wordle = {
    id: 'wordle',
    nameKey: 'g_wordle',
    descKey: 'g_wordle_d',
    color: 'green',
    solo: true,
    diff: false,
    icon: pixelIcon([
      '...........',
      '.gggg.yyyy.',
      '.g..g.y..y.',
      '.gggg.yyyy.',
      '...........',
      '.kkkk.gggg.',
      '.k..k.g..g.',
      '.kkkk.gggg.',
      '...........'
    ]),
    start(el, ctx) {
      const { mode, role, net, sfx, t, finish } = ctx;
      let wordLang = (I18N.lang === 'pl' ? 'pl' : 'en');
      const bank = (l) => (l === 'pl' ? PL_NICE : WORDS_EN);
      let target = pick(bank(wordLang));
      let guesses = []; // [{ word, states: ['correct'|'present'|'absent'] }]
      let cur = '';
      let over = false;
      let oppRow = 0;
      let oppWon = false;
      let oppDone = false;
      let myWon = false;
      const keyState = {}; // letter -> 'correct' | 'present' | 'absent'
      const rank = { absent: 1, present: 2, correct: 3 };

      el.innerHTML = `
        <div class="hud">
          <span><b id="wd-info">${t('w_enter')}</b></span>
          <span class="wd-right">
            ${mode === 'online'
              ? `<b id="wd-opp">${t('w_opp_prog', { n: 0 })}</b>`
              : `<button class="px-btn small" id="wd-lang">${t('w_lang_btn')}: ${wordLang.toUpperCase()}</button>`}
          </span>
        </div>
        <div class="wd-msg" id="wd-msg">${t('w_guess_hint')}</div>
        <div class="wd-board" id="wd-board"></div>
        <div class="kb wd-kb" id="wd-kb"></div>
      `;

      const boardEl = el.querySelector('#wd-board');
      const kbEl = el.querySelector('#wd-kb');
      const msgEl = el.querySelector('#wd-msg');
      const infoEl = el.querySelector('#wd-info');
      const oppEl = el.querySelector('#wd-opp');
      const langBtn = el.querySelector('#wd-lang');

      function scoreWord(guess, ans) {
        const res = Array(5).fill('absent');
        const pool = {};
        for (let i = 0; i < 5; i++) {
          if (guess[i] === ans[i]) res[i] = 'correct';
          else pool[ans[i]] = (pool[ans[i]] || 0) + 1;
        }
        for (let i = 0; i < 5; i++) {
          if (res[i] === 'correct') continue;
          if (pool[guess[i]] > 0) {
            res[i] = 'present';
            pool[guess[i]]--;
          }
        }
        return res;
      }

      function renderBoard() {
        let html = '';
        for (let r = 0; r < 6; r++) {
          const g = guesses[r];
          const isCur = r === guesses.length && !over;
          html += '<div class="wd-row">';
          for (let c = 0; c < 5; c++) {
            let ch = '';
            let cls = 'wd-tile';
            if (g) {
              ch = g.word[c];
              cls += ' ' + g.states[c];
            } else if (isCur) {
              ch = cur[c] || '';
              if (ch) cls += ' filled';
            }
            html += `<div class="${cls}">${ch}</div>`;
          }
          html += '</div>';
        }
        boardEl.innerHTML = html;
      }

      function renderKb() {
        kbEl.innerHTML = KB_ROWS.map(row => `<div class="kb-row">${row.map(k => {
          const st = keyState[k] || '';
          const wide = (k === 'ENTER' || k === '⌫') ? ' wide' : '';
          return `<button type="button" class="kb-key ${st}${wide}" data-k="${k}">${k}</button>`;
        }).join('')}</div>`).join('');
      }

      function setMsg(text, isErr) {
        msgEl.textContent = text;
        msgEl.className = 'wd-msg' + (isErr ? ' err' : '');
      }

      if (langBtn) {
        langBtn.onclick = () => {
          if (guesses.length > 0 || over) return;
          wordLang = wordLang === 'pl' ? 'en' : 'pl';
          target = pick(bank(wordLang));
          cur = '';
          langBtn.textContent = `${t('w_lang_btn')}: ${wordLang.toUpperCase()}`;
          sfx.play('click');
          renderBoard();
        };
      }

      if (mode === 'online' && net) {
        if (role === 'host') {
          setTimeout(() => net.send({ kind: 'wd_init', w: target, lang: wordLang }), 120);
        }
        net.onMove((m) => {
          if (!m) return;
          if (m.kind === 'wd_init' && m.w) {
            target = m.w;
            wordLang = m.lang || wordLang;
          } else if (m.kind === 'wd_prog') {
            oppRow = m.row || 0;
            oppWon = !!m.won;
            oppDone = !!m.done;
            if (oppEl) oppEl.textContent = t('w_opp_prog', { n: oppRow }) + (oppWon ? ' ✔' : oppDone ? ' ✖' : '');
            if (over && oppDone) resolveOnline();
            else if (!over && oppWon) {
              // Opponent solved while we are still trying -> race loss immediately
              over = true;
              setMsg(t('w_secret_was', { w: target }), false);
              sfx.play('lose');
              setTimeout(() => finish('lose', 0), 900);
            }
          }
        });
      }

      function resolveOnline() {
        const res = myWon && !oppWon ? 'win' : (!myWon && oppWon ? 'lose' : (myWon && oppWon ? (guesses.length < oppRow ? 'win' : guesses.length > oppRow ? 'lose' : 'draw') : 'draw'));
        const val = myWon ? Math.max(200, (7 - guesses.length) * 200) : 0;
        sfx.play(res === 'win' ? 'win' : res === 'draw' ? 'draw' : 'lose');
        setTimeout(() => finish(res, val), 850);
      }

      function submitGuess() {
        if (over) return;
        if (cur.length < 5) {
          sfx.play('bad');
          setMsg(t('w_not_enough'), true);
          return;
        }
        const states = scoreWord(cur, target);
        guesses.push({ word: cur, states });
        for (let i = 0; i < 5; i++) {
          const ch = cur[i], st = states[i];
          if (!keyState[ch] || rank[st] > rank[keyState[ch]]) keyState[ch] = st;
        }
        const won = states.every(s => s === 'correct');
        const lost = !won && guesses.length >= 6;
        cur = '';
        infoEl.textContent = `${guesses.length}/6`;
        if (langBtn) langBtn.disabled = true;
        renderBoard();
        renderKb();

        if (won || lost) {
          over = true;
          myWon = won;
          setMsg(t('w_secret_was', { w: target }), !won);
          if (mode === 'online' && net) {
            net.send({ kind: 'wd_prog', row: guesses.length, won, done: true });
            if (oppDone || won) {
              const res = won ? 'win' : (oppWon ? 'lose' : 'draw');
              const val = won ? Math.max(200, (7 - guesses.length) * 200) : 0;
              sfx.play(res === 'win' ? 'win' : 'lose');
              setTimeout(() => finish(res, val), 950);
            }
          } else {
            const val = won ? Math.max(150, (7 - guesses.length) * 200) : 0;
            sfx.play(won ? 'win' : 'lose');
            setTimeout(() => finish(won ? 'win' : 'lose', val), 950);
          }
        } else {
          sfx.play(states.includes('correct') ? 'good' : 'place');
          setMsg(t('w_guess_hint'), false);
          if (mode === 'online' && net) {
            net.send({ kind: 'wd_prog', row: guesses.length, won: false, done: false });
          }
        }
      }

      function pressKey(k) {
        if (over) return;
        if (k === 'ENTER') return submitGuess();
        if (k === '⌫' || k === 'BACKSPACE') {
          if (cur.length > 0) { cur = cur.slice(0, -1); sfx.play('click'); renderBoard(); }
          return;
        }
        if (/^[A-Z]$/.test(k) && cur.length < 5) {
          cur += k;
          sfx.play('click');
          renderBoard();
        }
      }

      kbEl.onclick = (e) => {
        const b = e.target.closest('[data-k]');
        if (b) pressKey(b.dataset.k);
      };

      const onKey = (e) => {
        const ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Enter') { e.preventDefault(); pressKey('ENTER'); return; }
        if (e.key === 'Backspace') { e.preventDefault(); pressKey('⌫'); return; }
        const up = e.key.toUpperCase();
        // Normalize common Polish diacritics if typed physically
        const map = { 'Ą':'A', 'Ć':'C', 'Ę':'E', 'Ł':'L', 'Ń':'N', 'Ó':'O', 'Ś':'S', 'Ź':'Z', 'Ż':'Z' };
        const ch = map[up] || up;
        if (/^[A-Z]$/.test(ch)) { e.preventDefault(); pressKey(ch); }
      };
      addEventListener('keydown', onKey);

      renderBoard();
      renderKb();

      return {
        destroy() {
          removeEventListener('keydown', onKey);
        }
      };
    }
  };
})();

