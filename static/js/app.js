var ko_data = {
  items: ko.observableArray(),
  next_page_url: ko.observable(''),
  loading: ko.observable(false),
  selected_movie: ko.observable(null),
  selected_tvshow: ko.observable(null),
  selected_season: ko.observable(null),
  selected_episode: ko.observable(null),
  background: ko.observable('')
};
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
})

function resetUi() {
  ko_data.items.removeAll();
  ko_data.next_page_url('');
  ko_data.loading(false);
  ko_data.selected_movie(null);
  ko_data.selected_tvshow(null);
  ko_data.selected_season(null);
  ko_data.selected_episode(null);
  ko_data.background('');
}

function loadMore() {
  $('#next-spinner').show();
  var current_view = ko_data.items()[0]._type + 's';
  var url = current_view + '/?url=' + encodeURIComponent(ko_data.next_page_url());
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

function pickPoster(movie) {
  var poster_keys = ['poster3', 'poster', 'poster2'];
  for (var y in poster_keys) {
    var key = poster_keys[y];
    if (key in movie && movie[key] != '0') {
      return movie[key];
    }
  }
}

function prepareMovies(movies) {
  for (var x in movies) {
    movies[x].ui_poster = pickPoster(movies[x]);
  }
}

function prepareTvshows(tvshows) {
  for (var x in tvshows) {
    tvshows[x].ui_poster = tvshows[x].poster;
  }
}

function showItems(items, reset) {
  ko_data.loading(false);
  ko_data.next_page_url(items[0].next || '')
  if (reset) {
    ko_data.items.removeAll();
  }
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

function showMovie(index) {
  var movie = ko_data.items()[index];
  movie.ui_duration = durationLabel(movie.duration);

  var stars = Math.round(movie.rating/2);  // rating is out of 10, stars are out of 5
  movie.ui_stars = [];
  for(var x=0; x<5; x++) {
    movie.ui_stars.push(x < stars ? 'star' : 'dislikes');
  }

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

  ko_data.selected_movie(ko_data.items()[index]);
  ko_data.background(movie.fanart || movie.fanart2);
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
    ko_data.background('');
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
