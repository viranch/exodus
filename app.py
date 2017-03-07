import data_setup

import urllib,json
from flask import Flask, render_template, request, jsonify, abort

from resources.lib.indexers import movies
from resources.lib.indexers import tvshows
from resources.lib.indexers import episodes
from resources.lib.modules import sources

app = Flask(__name__)


@app.route('/')
def webui():
    movie_genres = json.dumps(movies.movies().genres())
    tvshow_genres = json.dumps(tvshows.tvshows().genres())
    return render_template('webui.html', movie_genres=movie_genres, tvshow_genres=tvshow_genres)


def get_data(media_type, category, genre, query):
    getter = None
    if media_type == 'movie':
        getter = movies.movies()
    elif media_type == 'tvshow':
        getter = tvshows.tvshows()

    url = None
    if category:
        url = category
    elif genre:
        url = getter.genre_link % genre
    elif query:
        url = getter.search_link + urllib.quote_plus(query)
    else:
        url = request.args['url']

    data = getter.get(url) or []
    for item in data:
        item['_type'] = media_type

    return jsonify(data)


@app.route('/api/<media_type>')
@app.route('/api/<media_type>/<category>')
@app.route('/api/<media_type>/genre/<genre>')
@app.route('/api/<media_type>/search/<query>')
def get_movies(media_type, category=None, genre=None, query=None):
    if media_type not in ['movies', 'tvshows']:
        abort(404)
    return get_data(media_type[:-1], category, genre, query)


@app.route('/api/seasons')
def get_tvshow_seasons():
    args = request.args
    data = episodes.seasons().get(args['tvshowtitle'], args['year'], args['imdb'], args['tvdb'])
    return jsonify(data or [])


@app.route('/api/episodes')
def get_season_episodes():
    args = request.args
    data = episodes.episodes().get(args['tvshowtitle'], args['year'], args['imdb'], args['tvdb'], args['season'])
    return jsonify(data or [])


@app.route('/api/sources')
def get_sources():
    args = dict(request.args.iteritems())

    if 'tvdb' in args and 'episode' not in args:
        args['episode'] = '1'
        args.setdefault('season', '1')
        items = episodes.episodes().get(args['tvshowtitle'], args['year'], args['imdb'], args['tvdb'], args['season'])
        item = next(i for i in items if i['episode'] == args['episode'])
        if item:
            args['title'] = item['title']
            args['premiered'] = item['premiered']

    data = sources.sources().play(**args)
    return jsonify(data)


@app.route('/api/resolve', methods=['POST'])
def sources_resolve():
    item = json.loads(request.data)
    data = {'url': sources.sources().sourcesResolve(item)}
    return jsonify(data)


@app.route('/play/')
@app.route('/movies/play/')
@app.route('/tvshows/play/')
def play():
    args = dict(request.args.iteritems())

    if 'tvdb' in args and 'episode' not in args:
        args['episode'] = '1'
        args.setdefault('season', '1')
        items = episodes.episodes().get(args['tvshowtitle'], args['year'], args['imdb'], args['tvdb'], args['season'])
        item = next(i for i in items if i['episode'] == args['episode'])
        if item:
            args['title'] = item['title']
            args['premiered'] = item['premiered']

    data = sources.sources().play(**args)

    url = None
    for item in data:
        url = sources.sources().sourcesResolve(item)
        if url: break
    if url is None:
        abort(404)

    return render_template('player.html', url=url, item=args)


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, use_reloader=True)
