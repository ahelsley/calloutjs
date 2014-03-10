- Document the conceptual model of templates, models, instantiation, and
			stacking frames.  Finish documenting event handlers 'pre',
			'post', and 'load'.

- Document `.onModelChange`?

- Improve documentation by better-describing what is meant (and an example where the feature is useful) in the README.md's "Naming" section where it is written:

		Notice that the collections in the complex example above are referenced at the `<li>` level,
		but it is nice to push the actual object out of the template up to the "model" attribute of
		the enclosing `<ul>` so that there is a view and model for the list as a whole as well.

			var team	= teams[""+id];
			var keyword = {id:value, keyword:label};	// build model object
			team.keywords[""+value] = keyword;		// store in parent model

			onCollectionObjectAdded() {
				for (var i = 0; i < this.views.length; i++) {
					var vw = this.views[i];

					// this should be the frame at the top of the context stack just before the collection was traversed
					var context	 = newContext(new Frame({
						model:		team,
						template:	team.views[0].template, // setup by instantiateTemplate
						instance:	team.views[0],			// setup by instantiateTemplateOnce
						collection: teams,					// setup by instantiateTemplate
						n:			-1,						// setup by instantiateTemplate
						explicit:	{team:team}
					}));

				}
			}

			var kw_views = list.children;
			var template = kw_views[0];				// first element of list is the list-item template

			var modelName = template.getAttribute('foreach');
			if(modelName.charAt(0) === '#') {		// support breakpoints in template boundary-elements
				modelName = modelName.substring(1);
			}
			context[0].explicit[modelName] = keyword;
			var view = instantiateTemplateOnce(
				template,
				keyword,
				context,
				team.keywords,
				team.keywords.length
			);
			appendInstances([view], list, true);

- Add modifying punctuation to allow concise ways of dealing with the
			motivating templating output patterns listed ****below****.  Consider
			using .{next,previous}Sibling to implement.

- Auto-quote values to prevent XSS

- Consider bash-like operators to support conditional output if an
			object is null or empty-string?:

 >			X:-Y	=> (X !== null || X === '' ? X  : Y)
 >			X+Y		=> (X === null || X !== ''  ? '' : Y)

