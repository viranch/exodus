var ko_data = {
  items: ko.observableArray(),
  loading: ko.observable(false),
  sidebar: ko.observable(''),
  search_text: ko.observable(''),

  selected_movie: ko.observable(null),
  selected_tvshow: ko.observable(null),
  selected_season: ko.observable(null),
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
  var val = ko_data.selected_movie() || ko_data.selected_tvshow();
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
ko_data.sidebar_items = ko.observableArray([
  {
    title: 'Movies',
    items: [
      { name: 'People Watching', code: 'trending' },
      { name: 'Most Popular', code: 'popular' },
      { name: 'Most Voted', code: 'views' },
      { name: 'Box Office', code: 'boxoffice' },
      { name: 'Oscar Winners', code: 'oscars' },
      { name: 'In Theaters', code: 'theaters' },
      { name: 'New Movies', code: 'featured' }
    ],
    api: '/api/movies/{}'
  },
  {
    title: 'TV Shows',
    items: [
      { name: 'People Watching', code: 'trending' },
      { name: 'Most Popular', code: 'popular' },
      { name: 'Highly rated', code: 'rating' },
      { name: 'Most Voted', code: 'views' },
      { name: 'Airing today', code: 'airing' },
      { name: 'New TV Shows', code: 'premiere' }
    ],
    api: '/api/tvshows/{}'
  }
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
    var movie = movies[x];
    movie.ui_poster = pickPoster(movie, ['poster3', 'poster', 'poster2']);
    movie.show = function() {
      var m = $(this)[0];
      m.ui_duration = durationLabel(m.duration);

      var split_keys = ['genre', 'director', 'writer'];
      for (var x in split_keys) {
        var key = split_keys[x];
        m['ui_' + key + 's'] = m[key].split(' / ').join(', ');
      }

      var cast = [];
      for (var x in movie.cast) {
        for (var y in m.cast[x]) {
          var name = m.cast[x][y];
          if (name) cast.push(name);
        }
      }
      m.ui_cast = cast.join(', ');

      ko_data.selected_movie(m);
    };
    movie.play = function() {
      var m = $(this)[0];
      window.open('/play?' + serialize({
        title: m.title,
        year: m.year,
        imdb: m.imdb
      }));
    };
  }
}

function prepareTvshows(tvshows) {
  for (var x in tvshows) {
    var tvshow = tvshows[x];
    tvshow.ui_poster = pickPoster(tvshow, ['poster']);
    tvshow.rating = Math.round(tvshow.rating*10)/10;
    tvshow.show = function() {
      var t = $(this)[0];
      t.ui_duration = durationLabel(t.duration);
      ko_data.selected_tvshow(t);
    };
    tvshow.play = function() {
      var t = $(this)[0];
      window.open('/play?' + serialize({
        tvshowtitle: t.title,
        year: t.year,
        imdb: t.imdb,
        tvdb: t.tvdb,
      }));
    };
  }
}

function prepareSeasons(seasons) {
  for (var x in seasons) {
    var season = seasons[x];
    season.ui_poster = pickPoster(season, ['thumb', 'poster']);
    season.ui_index = x;
    season.ui_prev = (x > 0);
    season.ui_next = (x < seasons.length - 1);
    season.ui_year = (new Date(season.premiered)).getFullYear();
    season.show = function() {
      showSeason($(this)[0]);
    };
    season.play = function() {
      var s = $(this)[0];
      window.open('/play?' + serialize({
        tvshowtitle: s.tvshowtitle,
        year: s.year,
        imdb: s.imdb,
        tvdb: s.tvdb,
        season: s.season
      }));
    };
  }
}

function prepareEpisodes(episodes) {
  for (var x in episodes) {
    var episode = episodes[x];
    episode.ui_poster = pickPoster(episode, ['thumb', 'fanart']);
    episode.play = function() {
      var e = $(this)[0];
      window.open('/play?' + serialize({
        title: e.title,
        year: e.year,
        imdb: e.imdb,
        tvdb: e.tvdb,
        season: e.season,
        episode: e.episode,
        tvshowtitle: e.tvshowtitle,
        premiered: e.premiered
      }));
    };
  }
}

function showItems(items, reset) {
  if (reset) {
    ko_data.items.removeAll();
  }

  var media_type = items[0]._type;
  if (media_type == 'movie') {
    prepareMovies(items);
  } else if (media_type == 'tvshow') {
    prepareTvshows(items);
  }

  ko_data.loading(false);
  for (var x in items) {
    ko_data.items.push(items[x]);
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

showSeason = ko_data.selected_season;
function prevSeason(index) {
  return showSeason(ko_data.tvshow_seasons()[index-1]);
}
function nextSeason(index) {
  return showSeason(ko_data.tvshow_seasons()[index+1]);
}

$(document).ready(function() {
  genre_mapf = function(g){ return {name: g.name, code: g.url}; };
  ko_data.sidebar_items.push({
    title: 'Movie Genres',
    items: movie_genres.map(genre_mapf),
    api: '/api/movies/genre/{}'
  });
  ko_data.sidebar_items.push({
    title: 'TV Genres',
    items: tvshow_genres.map(genre_mapf),
    api: '/api/tvshows/genre/{}'
  });
  ko.applyBindings(ko_data);

  $('#search-input').focus();

  $('a.back-btn').click(function() {
    if (ko_data.selected_movie()) {
      ko_data.selected_movie(null);
    } else if (ko_data.selected_season()) {
      ko_data.selected_season(null);
    } else if (ko_data.selected_tvshow()) {
      ko_data.selected_tvshow(null);
    }
  });

  $('a.home-btn').click(function() {
    ko_data.selected_movie(null);
    ko_data.selected_season(null);
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

  sidebar_done = function(items) { showItems(items, true); }

  $('.search-category').click(function() {
    resetUi();
    $('.search-results-container').hide();
    ko_data.sidebar('');
    ko_data.loading(true);
    search_type = $(this).attr('data-search');
    $.ajax('/api/'+search_type+'/search/' + encodeURIComponent(ko_data.search_text())).done(sidebar_done);
  });

  $('ul.side-bar-list > li > a').click(function() {
    if ($(this).hasClass('selected')) {
      return true;
    }
    resetUi();
    ko_data.loading(true);
    var code = $(this).attr('data-code');
    var api = $(this).attr('data-api');
    ko_data.sidebar(api + code);
    var api_ep = api.replace('{}', encodeURIComponent(code));
    $.ajax(api_ep).done(sidebar_done);
  });
});
