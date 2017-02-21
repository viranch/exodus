var ko_data = {
  items: ko.observableArray(),
  loading: ko.observable(false),
  selected_movie: ko.observable(null),
  selected_tvshow: ko.observable(null),
  selected_season: ko.observable(null),
  selected_episode: ko.observable(null),
  tvshow_seasons: ko.observable([])
};
ko_data.next_page_url = ko.computed(function() {
  var items = ko_data.items();
  var len = items.length;
  if (len > 0) {
    return items[len-1].next || '';
  } else {
    return '';
  }
})
ko_data.background = ko.computed(function() {
  var item = ko_data.selected_movie() || ko_data.selected_tvshow();
  if (item) {
    return item.fanart || item.fanart2;
  } else {
    return '';
  }
})
ko_data.selected_media = ko.computed(function() {
  var val = ko_data.selected_movie() || ko_data.selected_tvshow() || ko_data.selected_season() || ko_data.selected_episode();
  var rm = val ? 'in' : 'out';
  var add = val ? 'out' : 'in';
  $('.section-side-bar-container > .side-bar').removeClass('transition-'+rm).addClass('transition-'+add);
  return val;
});
ko_data.bg_animator = ko.computed(function() {
  if (!ko_data.background()) {
    $('.background').removeClass('transition-in').addClass('transition-out');
  }
});
ko_data.dummy_seasons = ko.computed(function() {
  var tvshow = ko_data.selected_tvshow();
  if (tvshow) {
    ko_data.loading(true);
    $.ajax('/tvshows/?'+serialize({
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
  var url = '/' + current_view + '/?url=' + encodeURIComponent(ko_data.next_page_url());
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
}

function prepareMovies(movies) {
  for (var x in movies) {
    movies[x].ui_poster = pickPoster(movies[x], ['poster3', 'poster', 'poster2']);
  }
}

function prepareTvshows(tvshows) {
  for (var x in tvshows) {
    tvshows[x].ui_poster = tvshows[x].poster;
  }
}

function prepareSeasons(seasons) {
  for (var x in seasons) {
    seasons[x].ui_poster = pickPoster(seasons[x], ['thumb', 'poster']);
  }
}

function showItems(items, reset) {
  ko_data.loading(false);
  if (reset) {
    ko_data.items.removeAll();
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

function ratingStars(rating) {
  var num_stars = Math.round(rating/2);  // rating is out of 10, stars are out of 5
  var stars = [];
  for(var x=0; x<5; x++) {
    stars.push(x < num_stars ? 'star' : 'dislikes');
  }
  return stars;
}

function showMovie(movie) {
  movie.ui_duration = durationLabel(movie.duration);
  movie.ui_stars = ratingStars(movie.rating);

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
  tvshow.ui_stars = ratingStars(tvshow.rating);

  ko_data.selected_tvshow(tvshow);
}

$(document).ready(function() {
  $('#movie-browse > li > a').click(function() {
    resetUi();
    ko_data.loading(true);
    $.ajax($(this).attr('data-url'))
      .done(function(movies) {
        prepareMovies(movies);
        showItems(movies, true);
      });
  });

  $('#tvshow-browse > li > a').click(function() {
    resetUi();
    ko_data.loading(true);
    $.ajax($(this).attr('data-url'))
      .done(function(tvshows) {
        prepareTvshows(tvshows);
        showItems(tvshows, true);
      });
  });

  $('a.back-btn').click(function() {
    ko_data.selected_movie(null);
    ko_data.selected_tvshow(null);
    ko_data.selected_season(null);
    ko_data.selected_episode(null);
  });

  $('#dummy-bg').on('load', function() {
    $('.background')
      .css('background-image', 'url("'+ko_data.background()+'")')
      .removeClass('transition-out')
      .addClass('transition-in');
  })

  resetUi();
  ko.applyBindings(ko_data);
});
