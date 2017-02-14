import urllib
from flask import Flask, render_template, request

from resources.lib.indexers import movies
from resources.lib.indexers import tvshows
from resources.lib.indexers import episodes
from resources.lib.modules import sources

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html', movie_genres=movies.movies().genres(), tvshow_genres=tvshows.tvshows().genres())

@app.route('/movies/')
def movies_navigator():
    args = request.args
    m = movies.movies()
    url = args.get('url')
    if 'genre' in args:
        url = m.genre_link % args['genre']
    elif 'search' in args:
        url = m.search_link + urllib.quote_plus(args['search'])

    data = m.get(url, idx=False)
    for movie in data:
        movie['play_qs'] = urllib.urlencode({
            'title': movie['title'],
            'year': movie['year'],
            'imdb': movie['imdb'],
        })
        movie['_swaks_label'] = '%s (%s)' % (movie['title'], movie['year'])

    return render_template('list.html', items=data)

@app.route('/tvshows/')
def tvshows_navigator():
    args = request.args
    data = []
    if 'genre' in args or 'url' in args or 'search' in args:
        t = tvshows.tvshows()
        url = args.get('url')
        if 'genre' in args:
            url = t.genre_link % args['genre']
        elif 'search' in args:
            url = t.search_link + urllib.quote_plus(args['search'])

        data = t.get(url, idx=False)
        for show in data:
            show['href_qs'] = urllib.urlencode({
                'tvshowtitle': show['originaltitle'],
                'year': show['year'],
                'imdb': show['imdb'],
                'tvdb': show['tvdb']
            })
            show['_swaks_label'] = show['title']
    elif 'cals' in args:
        data = episodes.episodes().calendars(idx=False)
        for item in data:
            item['href_qs'] = urllib.urlencode({
                'cald': item['url']
            })
            item['_swaks_label'] = item['name']
    else:
        if 'season' in args or 'cal' in args or 'cald' in args:
            e = episodes.episodes()
            if 'season' in args:
                title, year, imdb, tvdb, season = args['tvshowtitle'], args['year'], args['imdb'], args['tvdb'], args['season']
                data = e.get(title, year, imdb, tvdb, season)
            else:
                if 'cal' in args:
                    url = args['cal']
                if 'cald' in args:
                    url = e.calendar_link % args['cald']
                data = e.calendar(url)
            try: multi = [i['tvshowtitle'] for i in data]
            except: multi = []
            multi = len([x for y,x in enumerate(multi) if x not in multi[:y]]) > 1
            for item in data:
                item['play_qs'] = urllib.urlencode({
                    'title': item['title'],
                    'year': item['year'],
                    'imdb': item['imdb'],
                    'tvdb': item['tvdb'],
                    'season': item['season'],
                    'episode': item['episode'],
                    'tvshowtitle': item['tvshowtitle'],
                    'premiered': item['premiered'],
                })
                item['_swaks_label'] = item.get('label', item['title'])
                item['_swaks_label'] = '%sx%02d . %s' % (item['season'], int(item['episode']), item['_swaks_label'])
                if multi:
                    item['_swaks_label'] = '%s - %s' % (item['tvshowtitle'], item['_swaks_label'])
        else:
            title, year, imdb, tvdb = args['tvshowtitle'], args['year'], args['imdb'], args['tvdb']
            data = episodes.seasons().get(title, year, imdb, tvdb, False)
            for item in data:
                item['href_qs'] = urllib.urlencode({
                    'tvshowtitle': item['tvshowtitle'],
                    'year': item['year'],
                    'imdb': item['imdb'],
                    'tvdb': item['tvdb'],
                    'season': item['season']
                })
                item['_swaks_label'] = 'Season %s' % item['season']

    return render_template('list.html', items=data)

@app.route('/movies/play/')
@app.route('/tvshows/play/')
def play():
    args = dict(request.args.iteritems())
    data = sources.sources().play(**args)
    url = None
    for item in data:
        print item.get('label')
        url = sources.sources().sourcesResolve(item)
        if url: break
    return render_template('player.html', url=url, item=args)

if __name__ == '__main__':
    app.run()
