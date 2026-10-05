// ==UserScript==
// @name		      YouTube Tweaks by MSerj
// @icon          https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @version		    2.1.0
// @description   A configurable collection of YouTube layout and feed enhancements, including no-scroll timestamp seeking.
// @match         *://youtube.com/*
// @match         *://www.youtube.com/*
// @match         *://m.youtube.com/*
// @match         *://*.youtube.com/*
// @exclude       *://studio.youtube.com/*
// @run-at		    document-start

// @copyright     2026, MSerj
// @license       MIT
// @namespace     https://greasyfork.org/en/users/1321619-mserj

// @grant         GM_registerMenuCommand
// @grant         GM_unregisterMenuCommand
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_addStyle
// ==/UserScript==

/* jshint esversion: 11 */

;(() => {
	'use strict'
	
	const CONFIG = {
		columns: 'ytd-items-per-row',
		features: {
			grid: 'yt-tweaks-grid',
			shorts: 'yt-tweaks-shorts',
			mix: 'yt-tweaks-mix',
			watched: 'yt-tweaks-watched'
		}
	}
	
	const selectors = {
		shorts: [
			'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
			'ytd-mini-guide-entry-renderer:has(a#endpoint[title*="shorts" i])',
			'ytd-guide-entry-renderer:has(a#endpoint[title*="shorts" i])',
			'yt-chip-cloud-chip-renderer:has(yt-formatted-string[title*="shorts" i])',
			'yt-tab-shape[tab-title*="shorts" i]',
			'ytm-reel-shelf-renderer',
			'ytd-reel-shelf-renderer',
			'ytm-item-section-renderer:has(.big-shorts-singleton)',
			'ytd-rich-section-renderer:has(a[href*="/shorts" i])',
			'ytd-video-renderer:has(a#thumbnail[href*="shorts" i])',
			'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)'
		],
		mix: [
			'yt-chip-cloud-chip-renderer:has(yt-formatted-string[title*=mixes i])',
			'ytd-rich-item-renderer:has(ytd-playlist-thumbnail):has(a[title^="Mix - "])',
			'ytd-rich-item-renderer:has(ytd-playlist-thumbnail):has(a[title="My Mix"])',
			'ytd-rich-item-renderer:has(yt-collections-stack):has([title^="Mix - "])',
			'ytd-rich-item-renderer:has(yt-collections-stack):has([title="My Mix"])',
			'ytd-radio-renderer:has(ytd-playlist-thumbnail):has(span[title^="Mix - "])',
			'ytd-compact-radio-renderer:has(yt-collections-stack):has(span[title^="Mix - "])'
		],
		watched: ['ytd-rich-item-renderer:has(#progress[style="width: 100%;"])', 'ytd-compact-video-renderer:has(#progress[style="width: 100%;"])'],
		mostRelevant: ['ytd-rich-section-renderer:has(ytd-rich-shelf-renderer)']
	}
	
	const clampColumns = value => Math.min(10, Math.max(1, parseInt(value) || 5))
	const state = {
		columns: clampColumns(localStorage.getItem(CONFIG.columns))
	}
	const options = [
		{ id: 'shorts', title: 'Hide Shorts', defaultValue: true, selectors: selectors.shorts },
		{ id: 'mix', title: 'Hide Mixes', defaultValue: false, selectors: selectors.mix },
		{ id: 'watched', title: 'Hide watched videos', defaultValue: false, selectors: selectors.watched },
		{ id: 'mostRelevant', title: 'Hide Most relevant', defaultValue: true, selectors: selectors.mostRelevant },
		{ id: 'redirect', title: 'Redirect channel to /videos', defaultValue: true },
		{ id: 'timestamps', title: 'No scroll to top on timestamps', defaultValue: true },
		{ id: 'grid', title: 'Grid adjustment', defaultValue: true }
	]
	const style = document.createElement('style')
	;(document.head || document.documentElement).appendChild(style)
	
	const excludedChannelPaths = ['/videos', '/community', '/live', '/playlists', '/search', '/podcasts', '/shorts', '/streams']
	let isRedirecting = false
	let lastCheckedPath = ''
	const redirectIfNeeded = () => {
		const currentPath = window.location.pathname
		if (!GM_getValue('redirect', true) || isRedirecting || currentPath === lastCheckedPath) return
		lastCheckedPath = currentPath
		const channelMatch = currentPath.match(/^(\/@[\w.-]+|\/(?:channel|c|user)\/[^/]+)/)
		if (!channelMatch) return
		const channelBasePath = channelMatch[0]
		const isExcluded = excludedChannelPaths.some(suffix => currentPath.startsWith(channelBasePath + suffix))
		if (isExcluded) return
		isRedirecting = true
		window.location.href = `https://www.youtube.com${channelBasePath}/videos`
	}
	const redirectObserver = new MutationObserver(redirectIfNeeded)
	redirectObserver.observe(document, { subtree: true, childList: true })
	redirectIfNeeded()
	
	const useOption = option => {
		const ref = {
			get value() {
				return GM_getValue(option.id, option.defaultValue)
			},
			set value(value) {
				GM_setValue(option.id, value)
			}
		}
		return { ...option, ref }
	}
	const usedOptions = options.map(useOption)
	const optionById = id => usedOptions.find(option => option.id === id)
	const menuEntries = [...usedOptions, { id: 'grid-columns', title: '🖥️ Set grid columns', type: 'columns' }]
	const register = entry => {
		if (entry.type === 'section') {
			GM_registerMenuCommand(entry.title, () => {}, { id: entry.id, autoClose: false })
			return
		}
		if (entry.type === 'columns') {
			GM_registerMenuCommand(
				entry.title,
				() => {
					const input = prompt('Please enter the number of videos displayed per line (1-10):', state.columns)
					if (input === null) return
					state.columns = clampColumns(input)
					localStorage.setItem(CONFIG.columns, state.columns)
					update()
					alert(`Current settings: ${state.columns} videos are displayed per line`)
				},
				{ id: entry.id, autoClose: false }
			)
			return
		}
		const { id, ref, title } = entry
		GM_registerMenuCommand(
			`${ref.value ? '✅' : '❌'} ${title}`,
			() => {
				ref.value = !ref.value
				if (id === 'redirect') redirectIfNeeded()
				setTimeout(update)
			},
			{ id, autoClose: false }
		)
	}
	const unregister = entry => {
		GM_unregisterMenuCommand(entry.id)
	}
	const update = () => {
		menuEntries.forEach(unregister)
		menuEntries.forEach(register)
		const rules = []
		if (optionById('grid').ref.value) {
			rules.push(`
				.style-scope.ytd-two-column-browse-results-renderer {
					--ytd-rich-grid-items-per-row: ${state.columns} !important;
					--ytd-rich-grid-gutter-margin: 0px !important;
				}`)
		}
		usedOptions
			.filter(option => option.ref.value && option.selectors)
			.forEach(option => {
				rules.push(`${option.selectors.join(',')}{ display: none !important; }`)
			})
		style.textContent = rules.join('\n')
	}
	
	// Timestamps: seek in place instead of letting YouTube scroll the page to the top
	const timestampToSeconds = text => {
		const t = (text || '').trim()
		if (!/^\d{1,2}(?::\d{1,2}){1,3}$/.test(t)) return null
		return t
			.split(':')
			.reverse()
			.reduce((total, part, i) => total + Number(part) * [1, 60, 3600, 86400][i], 0)
	}
	const seekTo = seconds => {
		const player = document.getElementById('movie_player')
		if (player && typeof player.seekTo === 'function') {
			player.seekTo(seconds, true)
			return
		}
		const video = document.querySelector('video')
		if (video) video.currentTime = seconds
	}
	document.addEventListener(
		'click',
		e => {
			if (!GM_getValue('timestamps', true) || !(e.target instanceof Element)) return
			let seconds = null
			const chapter = e.target.closest('a#endpoint')
			if (chapter) {
				// Chapter entries in the description / engagement panel
				seconds = timestampToSeconds(chapter.querySelector('#details #time')?.textContent)
			} else {
				// Timestamp links in description or comments
				const link = e.target.closest('a')
				if (link) seconds = timestampToSeconds(link.textContent)
			}
			if (seconds === null) return
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
			seekTo(seconds)
		},
		{ capture: true }
	)
	
	update()
})()
