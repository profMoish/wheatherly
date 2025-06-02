


//куки

// Устанавливаем cookie
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days*24*60*60*1000));
      expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (encodeURIComponent(value) || "")  + expires + "; path=/";
}

// Проверяем, есть ли uuid, если нет — генерируем и сохраняем
function getUUID() {
  let uuid = document.cookie
    .split('; ')
    .find(row => row.startsWith('uuid='))
    ?.split('=')[1];
  if (!uuid) {
      uuid = crypto.randomUUID();
      setCookie('uuid', uuid, 30); // сохраняем на 30 дней
  }
  return uuid;
}



// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// поле ввода поиска
const input = document.getElementById('search-box');
// контейнер для автодополнения
const suggestions = document.getElementById('suggestions');
// история поиска
let history = [];




     



// ИСТОРИЯ ПОИСКА
getSearchHistory();
async function getSearchHistory() {

  const uuid = getUUID();

  console.log('uuid', uuid);

   // TODO: сохранить историю в localStorage
  const res = await fetch(`https://wheatherly.onrender.com/history`, {
    headers: {
    'Content-Type': 'application/json',
    'X-User-UUID': uuid, // произвольный заголовок
  }}); // чтобы куки отправлялись при разных доменах бекнда и фронта
      
  history = await res.json();

  if (history.length > 0) {
    suggestions.innerHTML = '';

    renderSearchHistory();
  }
};


// Отрисовать историю
function renderSearchHistory() {
  const suggestions = document.getElementById("suggestions");

  history.forEach(item => {
      
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML =  `<span class="history-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" class="history-icon">
              <circle cx="9" cy="9" r="8" stroke="white" stroke-width="2" fill="none"/>
              <line x1="9" y1="5" x2="9" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <line x1="9" y1="9" x2="12" y2="11" stroke="white" stroke-width="2" stroke-linecap="round"/>
                  </svg>`
      
      div.appendChild(document.createTextNode(item.city));
      div.addEventListener('click', () => {
                  
          input.value = '';
          suggestions.innerHTML = '';

          history.unshift({city: item.city, lat: item.lat, lon: item.lon});
          renderSearchHistory();
          getWeather(item.city, item.lat, item.lon);

      });
      suggestions.appendChild(div);
  });
}









// ПОИСК ГОРОДА

input.addEventListener('input', async () => {
  

  const query = input.value.trim();

  // Запрос координат при вводе от 2 символов ("Мо" — самый короткий город, Франция)
  if (query.length < 2) {
    suggestions.innerHTML = 'город не найден';
    return;
  }
  suggestions.innerHTML = 'поиск...';

  // TODO: можно расмотрет формат protobuf 
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=ru&format=json`;

    try {
        // Отправляем запрос на сервер
        const res = await fetch(url);
        const data = await res.json();

        // Если нет результатов, то сообщаем пользователю
        if (!data.results) {
            suggestions.innerHTML = 'город не найден';
            return;
        }

        suggestions.innerHTML = '';
        // TODO: улучшить автодополнение при ошибках пользователя
        data.results.forEach((item) => {
            const div = document.createElement('div');
            div.classList.add('suggestion');
            const name = `${item.name}, ${item.country}`;
            div.textContent = name;
            div.addEventListener('click', () => {
                
                input.value = '';
                suggestions.innerHTML = '';
                history.unshift({city: name, lat: item.latitude, lon: item.longitude});
                renderSearchHistory();
                // TODO: если город уже есть добавить и удалить старый прогноз
                getWeather(name, item.latitude, item.longitude);
            });
            //не добавлять город если он уже есть в истории
            if (!history.includes(name)) {
                suggestions.appendChild(div);
            }
        
        });
        renderSearchHistory();

    } catch (err) {
        suggestions.innerHTML = 'приносим извинения, что-то пошло не так';
        // TODO: отправить ошибку на сервер
        console.error(err);
    }
});

async function getWeather(city, lat, lon) {

    const uuid = getUUID();

    document.getElementById('loading').hidden = false;
    
    const res = await fetch(`https://wheatherly.onrender.com/get_weather?city=${city}&lat=${lat}&lon=${lon}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-UUID': uuid, // произвольный заголовок
      }
    }); // чтобы куки отправлялись при разных доменах бекнда и фронта
      
    const data = await res.json();
    


    // Создаём отдельный контейнер для нового города
    const forecastBlock = document.createElement('div');
    forecastBlock.className = 'forecast-container';
  
    // Шапка — название города
    const cityDiv = document.createElement('div');
    cityDiv.className = 'forecast-city';
    cityDiv.textContent = city;
  
    // Контейнер для дней
    const daysDiv = document.createElement('div');
    daysDiv.className = 'forecast-days';
  
    // Заполняем прогноз на 7 дней
    const dates = data.daily.time;
    const minTemps = data.daily.temperature_2m_min;
    const maxTemps = data.daily.temperature_2m_max;
    const precipitation = data.daily.precipitation_sum;
  
    const monthShown = new Set();
  
    daysDiv.innerHTML = dates.map((dateStr, i) => {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.toLocaleDateString("ru-RU", { month: "short" });
      const showMonth = !monthShown.has(month);
      monthShown.add(month);
  
      const displayDate = showMonth ? `${day} ${month}` : day;
      const precipitationIcon = precipitation[i] > 0 ? '🌧️' : '☀️';
  
      return `
        <div class="forecast-day">
          <div class="date">${displayDate}</div>
          <div>🌤️ ${maxTemps[i]}°C</div>
          <div>🌙 ${minTemps[i]}°C</div>
          <div>${precipitationIcon} ${precipitation[i]}мм</div>
        </div>
      `;
    }).join("");
  
    // Вставляем всё в блок
    forecastBlock.appendChild(cityDiv);
    forecastBlock.appendChild(daysDiv);
  
    // Добавляем блок города в общий контейнер
    document.getElementById("all-forecasts").appendChild(forecastBlock);
    
    document.getElementById('loading').hidden = true;
  }
  

  


  
