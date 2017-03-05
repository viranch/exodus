var ko_data = {
  items: ko.observableArray(),
  loading: ko.observable(false),
  sidebar: ko.observable(''),
  search_text: ko.observable(''),

  selected_movie: ko.observable(null),
  selected_tvshow: ko.observable(null),
  selected_season: ko.observable(null),
  tvshow_seasons: ko.observable([]),
  season_episodes: ko.observable([]),
  autoplay: ko.observable(null),
  season_idx: ko.observable(-1),
  episode_idx: ko.observable(-1),

  show_modal: ko.observable(false),
  modal_loading_index: ko.observable(-1),
  modal_selected_index: ko.observable(-1),
  video_sources: ko.observable([]),
  show_player: ko.observable(false),
  sticky_controls: ko.observable(false),
  buffering: ko.observable(false),
  show_video: ko.observable(false),
  volume_icon: ko.observable('volume-up'),
  showPrevBtn: ko.observable(false),
  showNextBtn: ko.observable(false),
  videoTitle: ko.observable(''),
};

var dragging = {
  volume: false,
  seek: false,
};

var controlsTimeout;

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
  return ko_data.selected_movie() || ko_data.selected_tvshow();
});

// ko subscriptions
ko_data.background.subscribe(function(bg) {
  if (!bg) {
    $('.background').removeClass('transition-in').addClass('transition-out');
    $('.background-bg').show();
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
        var ap = ko_data.autoplay();
        if (ap != null) {
          ap = (seasons.length + ap) % seasons.length;
          seasons[ap].show();
        }
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
        var ap = ko_data.autoplay();
        if (ap != null) {
          ko_data.autoplay(null);
          ap = (episodes.length + ap) % episodes.length;
          episodes[ap].play();
        }
      });
    ko_data.season_idx(ko_data.tvshow_seasons().indexOf(season));
  } else {
    ko_data.season_episodes([]);
    ko_data.season_idx(-1);
  }
});

ko_data.episode_idx.subscribe(function(idx) {
  if (idx < 0) {
    ko_data.showPrevBtn(false);
    ko_data.showNextBtn(false);
  } else {
    var season_idx = ko_data.season_idx();
    ko_data.showPrevBtn(idx > 0 || season_idx > 0);
    var episodes = ko_data.season_episodes().length;
    var seasons = ko_data.tvshow_seasons().length;
    ko_data.showNextBtn(idx < episodes-1 || season_idx < seasons-1);
  }
});

ko_data.show_modal.subscribe(function(show) {
  $('.modal').modal(show ? 'show' : 'hide');
});
ko_data.show_modal.extend({notify: 'always'});

// ko static data
ko_data.sidebar_items = [
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
    api: '/api/movies'
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
    api: '/api/tvshows'
  }
];

// ko functions - so we don't have to handle
//   DOM elements coming and going
ko_data.loadSidebarItem = function(data, event) {
  var target = $(event.target);
  if (target.hasClass('selected')) {
    return true;
  }
  resetUi();
  ko_data.loading(true);

  var apiBase = target.attr('data-api');
  ko_data.sidebar(apiBase + data.code);
  var api = apiBase + '/' + encodeURIComponent(data.code);

  $.ajax(api).done(sidebar_done);
};

ko_data.showControls = function() {
  var controls = $('.video-controls');
  if (controls.hasClass('transition-out')) {
    controls.removeClass('transition-out').addClass('transition-in');
  }
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  controlsTimeout = setTimeout(function() {
    if (!ko_data.sticky_controls()) {
      $('.video-controls').removeClass('transition-in').addClass('transition-out');
    }
  }, 2000);
};

ko_data.stickControls = function() {
  ko_data.sticky_controls(true);
};
ko_data.unstickControls = function() {
  ko_data.sticky_controls(false);
};

ko_data.closePlayer = function() {
  ko_data.exitFullscreen();
  ko_data.show_player(false);

  // reset stuff
  ko_data.modal_loading_index(-1);
  ko_data.modal_selected_index(-1);
  ko_data.video_sources([]);
  ko_data.sticky_controls(false);
  ko_data.buffering(false);
  ko_data.show_video(false);
  ko_data.episode_idx(-1);
};

ko_data.toggle_play = function() {
  var vid = $('#html-video')[0];
  vid.paused ? vid.play() : vid.pause();
};

ko_data.enterFullscreen = function() {
  var e = $('.video-player')[0];
  var call = e.requestFullscreen || e.mozRequestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen;
  call.call(e);
  $('.enter-fullscreen-btn').addClass('hidden');
  $('.exit-fullscreen-btn').removeClass('hidden');
};

ko_data.exitFullscreen = function() {
  var e = document;
  var call = e.exitFullscreen || e.mozExitFullscreen || e.webkitExitFullscreen || e.msExitFullscreen;
  call.call(e);
  $('.exit-fullscreen-btn').addClass('hidden');
  $('.enter-fullscreen-btn').removeClass('hidden');
};

ko_data.vid_timeupdate = function() {
  var vid = $('#html-video')[0];
  if (!dragging.seek) {
    var progress = (vid.currentTime*100)/vid.duration;
    $('.player-seek-bar .player-slider-buffer').css('width', '0%');
    $('.player-seek-bar .player-slider-progress').css('width', progress+'%');
    $('.player-seek-bar .player-slider-thumb').css('left', progress+'%');
  }
  $('.player-position').text(videoDuration(vid.currentTime));
};
ko_data.vid_loadedmetadata = function() {
  var vid = $('#html-video')[0];
  $('.player-duration').text(videoDuration(vid.duration));
  ko_data.show_video(true);
};
ko_data.vid_play = function() {
  $('.video-player').removeClass('paused');
  $('.video-controls-left > .play-btn').addClass('hidden');
  $('.video-controls-left > .pause-btn').removeClass('hidden');
};
ko_data.vid_pause = function() {
  $('.video-controls-left > .play-btn').removeClass('hidden');
  $('.video-controls-left > .pause-btn').addClass('hidden');
  $('.video-player').addClass('paused');
};
ko_data.vid_bufferStart = function() {
  ko_data.buffering(true);
};
ko_data.vid_bufferStop = function() {
  ko_data.buffering(false);
};
ko_data.vid_volumechange = function() {
  var video = $('#html-video')[0];
  var vol = video.volume * !video.muted;
  var volPct = vol*100;
  $('.player-volume-slider .player-slider-progress').css('width', volPct+'%');
  $('.player-volume-slider .player-slider-thumb').css('left', volPct+'%');
  if (vol == 0) {
    ko_data.volume_icon('mute');
  } else if (vol < 0.5) {
    ko_data.volume_icon('volume-down');
  } else {
    ko_data.volume_icon('volume-up');
  }
};
ko_data.vid_ended = function() {
  if (ko_data.episode_idx() > 0) {
    ko_data.playNext();
  }
};

ko_data.dragStop = function() {
  for (var x in dragging) {
    dragging[x] = false;
  }
};

ko_data.startVolumeDrag = function(data, event) {
  dragging.volume = true;
  setVolume(event.pageX);
};

ko_data.dragVolumeBar = function(data, event) {
  if (dragging.volume) {
    setVolume(event.pageX);
  }
};

ko_data.toggle_mute = function() {
  var video = $('#html-video')[0];
  video.muted = !video.muted;
};

ko_data.closeModal = function() {
  ko_data.show_modal(false);
};

ko_data.showScrub = function() {
  $('.player-scrub-preview').removeClass('hidden');
};
ko_data.hideScrub = function() {
  $('.player-scrub-preview').addClass('hidden');
};

ko_data.startSeekDrag = function() {
  dragging.seek = true;
};

ko_data.dragSeekBar = function(data, event) {
  var seek = getSeekPosition(event.pageX);

  // move scrubber
  $('.player-scrub-preview').css('left', event.pageX);
  $('.player-scrub-preview-time').text(videoDuration($('#html-video')[0].duration * seek));

  if (dragging.seek) {
    // move thumb
    var seekPct = seek * 100;
    $('.player-seek-bar .player-slider-buffer').css('width', seekPct+'%');
    $('.player-seek-bar .player-slider-thumb').css('left', seekPct+'%');
  }
};

ko_data.stopSeekDrag = function(data, event) {
  dragging.seek = false;
  // perform seek
  var video = $('#html-video')[0];
  video.currentTime = video.duration * getSeekPosition(event.pageX);
};

ko_data.playPrevious = function() {
  resetPlayer();
  if (ko_data.episode_idx() == 0) {
    ko_data.autoplay(-1); // we don't know previos season's last episode number yet, so autoplay last episode
    ko_data.tvshow_seasons()[ko_data.season_idx()-1].show();
  } else {
    ko_data.season_episodes()[ko_data.episode_idx()-1].play();
  }
};

ko_data.playNext = function() {
  resetPlayer();
  if (ko_data.episode_idx() == ko_data.season_episodes().length - 1) {
    var next_season_idx = ko_data.season_idx() + 1;
    var seasons = ko_data.tvshow_seasons();
    if (next_season_idx < seasons.length) {
      ko_data.autoplay(0);
      seasons[next_season_idx].show();
    } else {
      // nothing to play anymore
      closePlayer();
    }
  } else {
    ko_data.season_episodes()[ko_data.episode_idx()+1].play();
  }
};

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

function setVolume(pageX) {
  var volBar = $('.player-volume-slider');
  var video = $('#html-video')[0];
  var volPos = pageX - volBar.offset().left;
  var volume = volPos/volBar.width();
  video.volume = Math.max(Math.min(volume, 1), 0);
}

function getSeekPosition(pageX) {
  var seekBar = $('.player-seek-bar');
  var seekPos = pageX - seekBar.offset().left;
  return Math.max(Math.min(seekPos/seekBar.width(), 1), 0);
}

function resetPlayer() {
  ko_data.modal_selected_index(-1);
  ko_data.video_sources([]);

  var video = $('#html-video');
  video[0].currentTime = 0;
  video[0].play();
  video.attr('src', '');
  $('.player-seek-bar .player-slider-buffer').css('width', '0%');
  $('.player-seek-bar .player-slider-progress').css('width', '0%');
  $('.player-seek-bar .player-slider-thumb').css('left', '0%');
  $('.player-duration').text('');

  ko_data.show_video(false);
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
      for (var x in m.cast) {
        for (var y in m.cast[x]) {
          var name = m.cast[x][y];
          if (name) cast.push(name);
        }
      }
      m.ui_cast = cast.join(', ');

      ko_data.selected_movie(m);
    };
    movie.open_imdb = function() {
      window.open('http://www.imdb.com/title/' + $(this)[0].imdb + '/');
    };
    movie.play = function() {
      playMedia($(this)[0]);
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

      var split_keys = ['genre'];
      for (var x in split_keys) {
        var key = split_keys[x];
        t['ui_' + key + 's'] = t[key].split(' / ').join(', ');
      }

      var cast = [];
      for (var x in t.cast) {
        for (var y in t.cast[x]) {
          var name = t.cast[x][y];
          if (name) cast.push(name);
        }
      }
      t.ui_cast = cast.join(', ');

      ko_data.selected_tvshow(t);
    };
    tvshow.open_imdb = function() {
      window.open('http://www.imdb.com/title/' + $(this)[0].imdb + '/');
    };
    tvshow.play = function() {
      ko_data.autoplay(0);
      $(this)[0].show();
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
      var s = $(this)[0];
      showSeason(s);
    };
    season.play = function() {
      ko_data.autoplay(0);
      $(this)[0].show();
    };
  }
}

function prepareEpisodes(episodes) {
  for (var x in episodes) {
    var episode = episodes[x];
    episode.ui_poster = pickPoster(episode, ['thumb', 'fanart']);
    episode.play = function() {
      var e = $(this)[0];
      ko_data.episode_idx(ko_data.season_episodes().indexOf(e));
      playMedia(e);
    };
  }
}

function playMedia(media) {
  if (media.show) {
    media.show();
  }
  var title = ko_data.selected_media().title;
  var ep = ko_data.episode_idx();
  if (ep > -1) {
    if (ep.length == 1) {
      ep = '0' + ep;
    }
    title += ' - ' + ko_data.season_idx() + 'x' + ep + ' - ' + media.title;
  }
  ko_data.videoTitle(title);
  ko_data.show_player(true);
  ko_data.buffering(true);
  var params = {};
  var attrs = [
    'title',
    'year',
    'imdb'
  ];
  if (ep > -1) {
    attrs.concat([
      'tvdb',
      'season',
      'episode',
      'tvshowtitle',
      'premiered'
    ]);
  }
  for (var x in attrs) {
    var attr = attrs[x];
    if (media[attr]) {
      params[attr] = media[attr];
    }
  }
  var url = '/api/sources?' + serialize(params);
  $.ajax(url).done(function(sources) {
    for (var x in sources) {
      var source = sources[x];
      source.label = (source.provider + ' | ' + source.source).toUpperCase() + ' (' + source.quality + ')';
      source.ui_failure = ko.observable(false);
      source.ui_video_url = null;
      source.play = function() {
        idx = ko_data.video_sources().indexOf($(this)[0]);
        resolveSource(idx, true);
      };
    }
    ko_data.video_sources(sources);
    ko_data.buffering(false);
    ko_data.show_modal(true);
    resolveSource(0);
  });
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

function resolveSource(index, sticky) {
  ko_data.modal_loading_index(index);
  var source = ko_data.video_sources()[index];
  if (source) {
    if (source.ui_video_url) {
      return resolutionSuccess(source.ui_video_url, index);
    } else if (source.ui_failure()) {
      return resolutionFailure(index, sticky);
    }

    $.ajax({
      url: '/api/resolve',
      type: 'post',
      dataType: 'json',
      data: JSON.stringify(source),
      contentType: 'application/json; charset=utf-8',
    }).done(function(data) {
        var url = data.url;
        if (url) {
          resolutionSuccess(url, index);
        } else {
          resolutionFailure(index, sticky);
        }
      });
  } else {
    ko_data.show_modal(false);
    //$('.video-player').addClass('error');
    ko_data.closePlayer();
  }
}

function resolutionSuccess(url, index) {
  ko_data.video_sources()[index].ui_video_url = url;
  if (index == ko_data.modal_loading_index()) {
    ko_data.modal_loading_index(-1);
    ko_data.modal_selected_index(index);
    ko_data.show_modal(false);
    play(url);
  }
}

function resolutionFailure(index, sticky) {
  ko_data.video_sources()[index].ui_failure(true);
  if (sticky) {
    return ko_data.modal_loading_index(-1);
  } else {
    return resolveSource(index+1);
  }
}

function play(url) {
  ko_data.show_modal(false);
  var video = $('#html-video');
  if (video.attr('src') != url) {
    video.attr('src', url)[0].play();
  }
}

function videoDuration(duration) {
  var hours = Math.floor(duration/3600);
  var mins = Math.floor((duration%3600)/60);
  var secs = Math.round(duration%60);
  var label = ''
  if (hours > 0) {
    label += hours + ':';
  }
  if (mins < 10 && label != '') {
    mins = '0'+mins;
  }
  if (secs < 10) {
    secs = '0'+secs;
  }
  return label + mins + ':' + secs;
}

$(document).ready(function() {
  genre_mapf = function(g){ return {name: g.name, code: g.url}; };
  ko_data.sidebar_items.push({
    title: 'Movie Genres',
    items: movie_genres.map(genre_mapf),
    api: '/api/movies/genre'
  });
  ko_data.sidebar_items.push({
    title: 'TV Genres',
    items: tvshow_genres.map(genre_mapf),
    api: '/api/tvshows/genre'
  });
  ko.options.deferUpdates = true;
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
    $('.background-bg').hide();
    $('.background, .video-background-image')
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
});
