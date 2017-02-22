var ko_data = {
  items: ko.observableArray(),
  loading: ko.observable(false),
  sidebar: ko.observable(''),
  search_text: ko.observable(''),
  movie_genres: ko.observable([]),
  tvshow_genres: ko.observable([]),

  selected_movie: ko.observable(null),
  selected_tvshow: ko.observable(null),
  selected_season: ko.observable(null),
  selected_episode: ko.observable(null),
  tvshow_seasons: ko.observable([]),
  season_episodes: ko.observable([])
};

// ko computed data
ko_data.next_page_url = ko.computed(function() {
  var items = ko_data.items();
  var len = items.length;
  if (len > 0) {
    return items[len-1].next || '';
  } else {
    return '';
  }
});

ko_data.background = ko.computed(function() {
  var item = ko_data.selected_movie() || ko_data.selected_tvshow();
  if (item) {
    return item.fanart || item.fanart2;
  } else {
    return '';
  }
});

ko_data.selected_media = ko.computed(function() {
  var val = ko_data.selected_movie() || ko_data.selected_tvshow() || ko_data.selected_season() || ko_data.selected_episode();
  var rm = val ? 'in' : 'out';
  var add = val ? 'out' : 'in';
  $('.section-side-bar-container > .side-bar').removeClass('transition-'+rm).addClass('transition-'+add);
  return val;
});

// ko subscriptions
ko_data.background.subscribe(function(bg) {
  if (!bg) {
    $('.background').removeClass('transition-in').addClass('transition-out');
  }
});

ko_data.selected_tvshow.subscribe(function(tvshow) {
  if (tvshow) {
    ko_data.loading(true);
    $.ajax('/api/seasons?'+serialize({
      tvshowtitle: tvshow.originaltitle,
      year: tvshow.year,
      imdb: tvshow.imdb,
      tvdb: tvshow.tvdb
    }))
      .done(function(seasons) {
        prepareSeasons(seasons);
        ko_data.loading(false);
        ko_data.tvshow_seasons(seasons);
      });
  } else {
    ko_data.tvshow_seasons([]);
  }
});

ko_data.selected_season.subscribe(function(season) {
  if (season) {
    ko_data.loading(true);
    $.ajax('/api/episodes?'+serialize({
      tvshowtitle: season.tvshowtitle,
      year: season.year,
      imdb: season.imdb,
      tvdb: season.tvdb,
      season: season.season
    }))
      .done(function(episodes) {
        prepareEpisodes(episodes);
        ko_data.loading(false);
        ko_data.season_episodes(episodes);
      });
  } else {
    ko_data.season_episodes([]);
  }
});

// ko static data
ko_data.movie_types = ko.observable([
  { name: 'People Watching', code: 'trending' },
  { name: 'Most Popular', code: 'popular' },
  { name: 'Most Voted', code: 'views' },
  { name: 'Box Office', code: 'boxoffice' },
  { name: 'Oscar Winners', code: 'oscars' },
  { name: 'In Theaters', code: 'theaters' },
  { name: 'New Movies', code: 'featured' }
]);
ko_data.tvshow_types = ko.observable([
  { name: 'People Watching', code: 'trending' },
  { name: 'Most Popular', code: 'popular' },
  { name: 'Highly rated', code: 'rating' },
  { name: 'Most Voted', code: 'views' },
  { name: 'Airing today', code: 'airing' },
  { name: 'New TV Shows', code: 'premiere' }
]);

(function($){
  $.fn.extend({
    donetyping: function(callback, timeout){
      timeout = timeout || 1e3; // 1 second default timeout
      var timeoutReference,
        doneTyping = function(el){
          if (!timeoutReference) return;
          timeoutReference = null;
          callback.call(el);
        };
      return this.each(function(i,el){
        var $el = $(el);
        // Chrome Fix (Use keyup over keypress to detect backspace)
        // thank you @palerdot
        $el.is(':input') && $el.on('keyup keypress paste',function(e){
          // This catches the backspace button in chrome, but also prevents
          // the event from triggering too preemptively. Without this line,
          // using tab/shift+tab will make the focused element fire the callback.
          if (e.type=='keyup' && e.keyCode!=8) return;

          // Check if timeout has been set. If it has, "reset" the clock and
          // start over again.
          if (timeoutReference) clearTimeout(timeoutReference);
          timeoutReference = setTimeout(function(){
            // if we made it here, our timeout has elapsed. Fire the
            // callback
            doneTyping(el);
          }, timeout);
        }).on('blur',function(){
          // If we can, fire the event since we're leaving the field
          doneTyping(el);
        });
      });
    }
  });
})(jQuery);

function serialize(obj) {
  var str = [];
  for(var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}

function resetUi() {
  ko_data.items.removeAll();
  ko_data.loading(false);
  ko_data.selected_movie(null);
  ko_data.selected_tvshow(null);
  ko_data.selected_season(null);
  ko_data.selected_episode(null);
}

function loadMore() {
  $('#next-spinner').show();
  var current_view = ko_data.items()[0]._type + 's';
  var url = '/api/' + current_view + '?url=' + encodeURIComponent(ko_data.next_page_url());
  $.ajax(url)
    .done(function(items) {
      if (current_view == 'movies') {
        prepareMovies(items);
      } else if (current_view == 'tvshows') {
        prepareTvshows(items);
      }
      $('#next-spinner').hide();
      showItems(items);
    });
}

function pickPoster(item, poster_keys) {
  for (var y in poster_keys) {
    var key = poster_keys[y];
    if (key in item && item[key] != '0') {
      return item[key];
    }
  }
  return '';
}

function prepareMovies(movies) {
  for (var x in movies) {
    movies[x].ui_poster = pickPoster(movies[x], ['poster3', 'poster', 'poster2']);
  }
}

function prepareTvshows(tvshows) {
  for (var x in tvshows) {
    tvshows[x].ui_poster = pickPoster(tvshows[x], ['poster']);
    tvshows[x].rating = Math.round(tvshows[x].rating*10)/10;
  }
}

function prepareSeasons(seasons) {
  for (var x in seasons) {
    seasons[x].ui_poster = pickPoster(seasons[x], ['thumb', 'poster']);
    seasons[x].ui_index = x;
    seasons[x].ui_prev = (x > 0);
    seasons[x].ui_next = (x < seasons.length - 1);
  }
}

function prepareEpisodes(episodes) {
  for (var x in episodes) {
    episodes[x].ui_poster = pickPoster(episodes[x], ['thumb', 'fanart']);
  }
}

function showItems(items, reset) {
  ko_data.loading(false);
  if (reset) {
    ko_data.items.removeAll();
  }

  var media_type = items[0]._type;
  if (media_type == 'movie') {
    prepareMovies(items);
  } else if (media_type == 'tvshow') {
    prepareTvshows(items);
  }

  for (var x in items) {
    ko_data.items.push(items[x]);
  }
}

function showItem(index) {
  var item = ko_data.items()[index];
  if (item._type == 'movie') {
    showMovie(item);
  } else if (item._type == 'tvshow') {
    showTvShow(item);
  }
}

function durationLabel(duration) {
  duration = Number(duration);
  var hours = Math.floor(duration / 60),
      mins = duration % 60;
  var label = '';
  if (hours > 0) {
    label += hours + ' hr';
  }
  if (mins > 0) {
    if (label.length > 0) {
      label += ' ';
    }
    label += mins + ' min';
  }
  return label;
}

function showMovie(movie) {
  movie.ui_duration = durationLabel(movie.duration);

  var split_keys = ['genre', 'director', 'writer'];
  for (var x in split_keys) {
    var key = split_keys[x];
    movie['ui_' + key + 's'] = movie[key].split(' / ').join(', ');
  }

  var cast = [];
  for (var x in movie.cast) {
    for (var y in movie.cast[x]) {
      var name = movie.cast[x][y];
      if (name) cast.push(name);
    }
  }
  movie.ui_cast = cast.join(', ');

  ko_data.selected_movie(movie);
}

function showTvShow(tvshow) {
  tvshow.ui_duration = durationLabel(tvshow.duration);

  ko_data.selected_tvshow(tvshow);
}

function showSeason(index) {
  var item = ko_data.tvshow_seasons()[index];
  ko_data.selected_season(item);
}

function prevSeason(index) {
  return showSeason(index-1);
}
function nextSeason(index) {
  return showSeason(index+1);
}

$(document).ready(function() {
  ko_data.movie_genres(movie_genres);
  ko_data.tvshow_genres(tvshow_genres);

  $('a.back-btn').click(function() {
    if (ko_data.selected_movie()) {
      ko_data.selected_movie(null);
    } else if (ko_data.selected_season()) {
      ko_data.season_episodes([]);
      ko_data.selected_season(null);
    } else if (ko_data.selected_tvshow()) {
      ko_data.tvshow_seasons([]);
      ko_data.selected_tvshow(null);
    } else {
      ko_data.selected_episode(null);
    }
  });

  $('a.home-btn').click(function() {
    ko_data.selected_movie(null);
    ko_data.season_episodes([]);
    ko_data.selected_season(null);
    ko_data.tvshow_seasons([]);
    ko_data.selected_tvshow(null);
  });

  $('#dummy-bg').on('load', function() {
    $('.background')
      .css('background-image', 'url("'+ko_data.background()+'")')
      .removeClass('transition-out')
      .addClass('transition-in');
  });

  $('.nav-bar-search-container input').donetyping(function() {
    ko_data.search_text($(this).val());
  }, 300);

  $('.search-category').click(function() {
    resetUi();
    $('.search-results-container').hide();
    ko_data.sidebar('');
    ko_data.loading(true);
    search_type = $(this).attr('data-search');
    $.ajax('/api/'+search_type+'/search/' + encodeURIComponent(ko_data.search_text()))
      .done(function(items) {
        showItems(items, true);
      });
  });

  resetUi();
  ko.applyBindings(ko_data);

  sidebar_done = function(items) { showItems(items, true); }

  $('#movie-browse > li > a').click(function() {
    if ($(this).hasClass('selected')) {
      return true;
    }
    resetUi();
    category = $(this).attr('data-category');
    ko_data.sidebar('movie_' + category);
    ko_data.loading(true);
    $.ajax('/api/movies/' + category).done(sidebar_done);
  });

  $('#tvshow-browse > li > a').click(function() {
    if ($(this).hasClass('selected')) {
      return true;
    }
    resetUi();
    category = $(this).attr('data-category');
    ko_data.sidebar('tvshow_' + category);
    ko_data.loading(true);
    $.ajax('/api/tvshows/' + category).done(sidebar_done);
  });

  $('#movie-genres > li > a').click(function() {
    if ($(this).hasClass('selected')) {
      return true;
    }
    resetUi();
    genre = $(this).attr('data-genre');
    ko_data.sidebar('m_g_' + genre);
    ko_data.loading(true);
    $.ajax('/api/movies/genre/' + encodeURIComponent(genre)).done(sidebar_done);
  });

  $('#tvshow-genres > li > a').click(function() {
    if ($(this).hasClass('selected')) {
      return true;
    }
    resetUi();
    genre = $(this).attr('data-genre');
    ko_data.sidebar('t_g_' + genre);
    ko_data.loading(true);
    $.ajax('/api/tvshows/genre/' + encodeURIComponent(genre)).done(sidebar_done);
  });
});
