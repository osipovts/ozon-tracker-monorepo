import { type LegalDocumentsType, legalUpdatedOn } from './legal-document.type.js';

export const privacyPolicy: LegalDocumentsType = {
  en: {
    title: 'Privacy Policy',
    updated: `Last updated: ${legalUpdatedOn}`,
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          'Нищебродская (a price tracker) is a small service at aleksei.undo.it that tracks the prices of products on marketplaces for the people who add them. It is run by an individual, the administrator of the service ("we").',
        ],
      },
      {
        heading: 'What data we keep',
        paragraphs: [
          'Account: your email address and, if you sign up with a password, a hash of it (Argon2id; we never keep the password itself). If you log in with Google or GitHub, we keep the identifier of your account at that provider.',
          'Login through Google or GitHub: we ask only for your account identifier, your email address and whether the provider has verified it. We do not receive your password, contacts, files or any other data of your Google or GitHub account.',
          'Devices: when you log in, we keep the time, your IP address and the user agent of your browser, to protect your account and to show you where you are logged in on the settings page.',
          'Products: the links you add, and the prices, titles, availability and pictures read from the public pages of those products. They are tied to your account.',
          'Browser storage: a session cookie that keeps you logged in (HttpOnly, necessary for the service), a short-lived cookie that exists while you log in through a provider, and your choices of theme and language in the local storage of your browser. We use no analytics, advertising or tracking cookies.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'Only to provide the service: to log you in, to read and show the prices of the products you track, to send you the messages about your account (for example, the confirmation of your email), and to keep the service secure and prevent abuse.',
          'The use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We do not sell your data and do not share it for advertising. It is stored on the server of the service.',
          'Google and GitHub receive your request to log in, when you choose them. To read the price of a product, the service opens its public page on the marketplace; the marketplace sees the request of the service, not you. If the service sends email, the provider of that email service handles the messages. We may disclose data when the law requires it.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Your data is kept while your account exists. Removing a product from your list stops tracking it for you; the product and its price history are deleted when nobody tracks it any more. Ended login sessions are deleted a day after they end.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'The service is served over HTTPS. Passwords are stored only as hashes, the session cookie cannot be read by scripts of a page, and the addresses of the pictures are signed and expire. No system is perfectly secure, but we take reasonable care.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can ask what data we keep about you, ask us to correct it, or ask us to delete your account and its data. Change your password and log out of other devices on the settings page. For the rest, contact the administrator of the service as described below.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'The service is not meant for children under 16, and we do not knowingly collect their data.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'We may update this policy; the date above tells when it was last changed. If a change is material, we will say so in the service.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'For questions about your data, contact the administrator of the service. The way to reach them is given in the consent screen of the login through Google, and on the page of the service where you got this link.',
        ],
      },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: `Обновлено: ${legalUpdatedOn}`,
    sections: [
      {
        heading: 'Кто мы',
        paragraphs: [
          'Нищебродская (трекер цен) - небольшой сервис на aleksei.undo.it, который следит за ценами товаров на маркетплейсах для тех, кто их добавил. Его ведёт частное лицо, администратор сервиса («мы»).',
        ],
      },
      {
        heading: 'Какие данные мы храним',
        paragraphs: [
          'Аккаунт: ваш адрес электронной почты и, если вы регистрируетесь с паролем, его хэш (Argon2id; сам пароль мы не храним). Если вы входите через Google или GitHub, мы храним идентификатор вашего аккаунта у этого провайдера.',
          'Вход через Google или GitHub: мы запрашиваем только идентификатор аккаунта, адрес электронной почты и отметку, подтвердил ли провайдер этот адрес. Мы не получаем ваш пароль, контакты, файлы и другие данные аккаунта Google или GitHub.',
          'Устройства: при входе мы сохраняем время, ваш IP-адрес и user agent браузера, чтобы защитить аккаунт и показать на странице настроек, где вы вошли.',
          'Товары: добавленные вами ссылки, а также цены, названия, наличие и картинки, прочитанные с публичных страниц этих товаров. Они связаны с вашим аккаунтом.',
          'Хранилище браузера: cookie сессии, которая держит вас в аккаунте (HttpOnly, необходима для работы), короткоживущая cookie на время входа через провайдера, а также ваш выбор темы и языка в localStorage браузера. Мы не используем cookie для аналитики, рекламы и слежки.',
        ],
      },
      {
        heading: 'Как мы их используем',
        paragraphs: [
          'Только чтобы работал сервис: войти в аккаунт, читать и показывать цены отслеживаемых товаров, отправлять сообщения об аккаунте (например, подтверждение почты), а также защищать сервис и не давать ему злоупотреблять.',
          'Использование и передача информации, полученной из API Google, соответствуют Политике Google API Services User Data Policy, включая требования Limited Use.',
        ],
      },
      {
        heading: 'С кем мы делимся',
        paragraphs: [
          'Мы не продаём ваши данные и не передаём их для рекламы. Они хранятся на сервере сервиса.',
          'Google и GitHub получают запрос на вход, когда вы выбираете их. Чтобы узнать цену товара, сервис открывает его публичную страницу на маркетплейсе; маркетплейс видит запрос сервиса, а не вас. Если сервис отправляет письма, их обрабатывает провайдер почты. Мы можем раскрыть данные, если этого требует закон.',
        ],
      },
      {
        heading: 'Как долго мы их храним',
        paragraphs: [
          'Данные хранятся, пока существует ваш аккаунт. Удаление товара из списка прекращает его отслеживание для вас; сам товар и история цен удаляются, когда его никто больше не отслеживает. Завершённые сессии входа удаляются через сутки после завершения.',
        ],
      },
      {
        heading: 'Безопасность',
        paragraphs: [
          'Сервис работает по HTTPS. Пароли хранятся только в виде хэшей, cookie сессии недоступна скриптам страницы, а адреса картинок подписаны и истекают. Совершенно безопасных систем не бывает, но мы принимаем разумные меры.',
        ],
      },
      {
        heading: 'Ваши права',
        paragraphs: [
          'Вы можете спросить, какие данные о вас мы храним, попросить их исправить или удалить ваш аккаунт вместе с данными. Сменить пароль и выйти на других устройствах можно на странице настроек. По остальному обращайтесь к администратору сервиса, как описано ниже.',
        ],
      },
      {
        heading: 'Дети',
        paragraphs: [
          'Сервис не предназначен для детей младше 16 лет, и мы сознательно не собираем их данные.',
        ],
      },
      {
        heading: 'Изменения',
        paragraphs: [
          'Мы можем обновлять эту политику; дата выше показывает, когда её меняли в последний раз. О существенных изменениях мы сообщим в сервисе.',
        ],
      },
      {
        heading: 'Контакты',
        paragraphs: [
          'По вопросам о ваших данных обращайтесь к администратору сервиса. Как с ним связаться, указано на экране согласия при входе через Google и на странице сервиса, откуда вы перешли по этой ссылке.',
        ],
      },
    ],
  },
};
