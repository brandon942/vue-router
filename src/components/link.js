/* @flow */

import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'
import { extend } from '../util/misc'
import { normalizeLocation } from '../util/location'
import { warn } from '../util/warn'

// work around weird flow bug
const toTypes: Array<Function> = [String, Object]
const eventTypes: Array<Function> = [String, Array]

const noop = () => { }

function initRoute(instance){ // init route variabls
	const current = instance.$route
	const router = instance.$router
	const resolved = instance.rr = router.resolve(
		instance.to,
		current,
		instance.append
	)
	const { route } = resolved
	const compareTarget = route.redirectedFrom
		? createRoute(null, normalizeLocation(route.redirectedFrom), null, router)
		: route

	const _isSameRoute = isSameRoute(current, compareTarget)
	instance._sr = _isSameRoute
	instance._icr = isIncludedRoute(current, compareTarget)
}

function Init(instance){
	const router = instance.$router
	
	initRoute(instance) // init route variables

	const classes = {}
	const globalActiveClass = router.options.linkActiveClass
	const globalExactActiveClass = router.options.linkExactActiveClass
	// Support global empty active class
	const activeClassFallback =
		globalActiveClass == null ? 'router-link-active' : globalActiveClass
	const exactActiveClassFallback =
		globalExactActiveClass == null
			? 'router-link-exact-active'
			: globalExactActiveClass
	const activeClass =
		instance.activeClass == null ? activeClassFallback : instance.activeClass
	const exactActiveClass =
		instance.exactActiveClass == null
			? exactActiveClassFallback
			: instance.exactActiveClass



	const handler = e => {
		const { location, route } = instance.rr
		const _isSameRoute = instance._sr
		const toForceRefresh = instance.refresh && _isSameRoute
		if (guardEvent(e)) {
			if (instance.replace || _isSameRoute) {
				router.replace(location, noop, null, toForceRefresh)
			} else {
				router.push(location, noop)
			}
		}
	}

	const on = { click: guardEvent }
	if (Array.isArray(instance.event)) {
		instance.event.forEach(e => {
			on[e] = handler
		})
	} else {
		on[instance.event] = handler
	}

	const data: any = { class: classes }


	let attributes = {}
	if (instance.tag === 'a') {
		data.on = on
		data.attrs = attributes
	} else {
		// find the first <a> child and apply listener and href
		const a = findAnchor(instance.$slots.default)
		if (a) {
			// in case the <a> is a static node
			a.isStatic = false
			const aData = (a.data = extend({}, a.data))
			aData.on = aData.on || {}
			// transform existing events in both objects into arrays so we can push later
			for (const event in aData.on) {
				const handler = aData.on[event]
				if (event in on) {
					aData.on[event] = Array.isArray(handler) ? handler : [handler]
				}
			}
			// append new listeners for router-link
			for (const event in on) {
				if (event in aData.on) {
					// on[event] is always a function
					aData.on[event].push(on[event])
				} else {
					aData.on[event] = handler
				}
			}

			a.data.attrs = attributes
		} else {
			// doesn't have <a> child, apply listener to self
			data.on = on
		}
	}
	
	
	instance._ac = activeClass
	instance._eac = exactActiveClass
	instance._cl = classes
	instance.hn = handler
	instance._att = attributes
	instance._dat = data  // also serves as the initialized flag
}



export default {
	name: 'RouterLink',
	props: {
		to: {
			type: toTypes,
			required: true
		},
		tag: {
			type: String,
			default: 'a'
		},
		exact: Boolean,
		refresh: Boolean, // If truthy, then the link always reloads the route (default: false = navigation is aborted if the route is the same)
		append: Boolean,
		replace: Boolean,
		activeClass: String,
		exactActiveClass: String,
		ariaCurrentValue: {
			type: String,
			default: 'page'
		},
		event: {
			type: eventTypes,
			default: 'click'
		}
	},
	watch: {
		to()	{
			initRoute(this)
		}
	},
	render(h: Function) {
		if(!this._dat) Init(this) // init
		
		
		const { location, route, href } = this.rr

		const isIncludedRoute = this._icr
		const _isSameRoute = this._sr
		
		var classes = this._cl
		var exactActiveClass = this._eac
		var activeClass = this._ac
		classes[exactActiveClass] = _isSameRoute
		classes[activeClass] = this.exact
			? classes[exactActiveClass]
			: isIncludedRoute

		const ariaCurrentValue = classes[exactActiveClass] ? this.ariaCurrentValue : null
		
		var attrs = this._att
		attrs['aria-current'] = ariaCurrentValue
		attrs.href = href

		
		const scopedSlot =
			!this.$scopedSlots.$hasNormal &&
			this.$scopedSlots.default &&
			this.$scopedSlots.default({
				href,
				route,
				navigate: this.hn,
				isActive: classes[activeClass],
				isExactActive: classes[exactActiveClass]
			})
		if (scopedSlot) {
			if (scopedSlot.length === 1) {
				return scopedSlot[0]
			} else if (scopedSlot.length > 1 || !scopedSlot.length) {
				if (process.env.NODE_ENV !== 'production') {
					warn(
						false,
						`RouterLink with to="${
						this.to
						}" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.`
					)
				}
				return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
			}
		}

		return h(this.tag, this._dat, this.$slots.default)
	}
}

function guardEvent(e) {
	// don't redirect with control keys
	if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
	// don't redirect when preventDefault called
	if (e.defaultPrevented) return
	// don't redirect on right click
	if (e.button !== undefined && e.button !== 0) return
	// don't redirect if `target="_blank"`
	if (e.currentTarget && e.currentTarget.getAttribute) {
		const target = e.currentTarget.getAttribute('target')
		if (/\b_blank\b/i.test(target)) return
	}
	// this may be a Weex event which doesn't have this method
	if (e.preventDefault) {
		e.preventDefault()
	}
	return true
}

function findAnchor(children) {
	if (children) {
		let child
		for (let i = 0; i < children.length; i++) {
			child = children[i]
			if (child.tag === 'a') {
				return child
			}
			if (child.children && (child = findAnchor(child.children))) {
				return child
			}
		}
	}
}
