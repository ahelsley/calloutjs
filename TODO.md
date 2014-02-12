- Document the conceptual model of templates, models, instantiation, and
			stacking frames.  Finish documenting event handlers 'pre',
			'post', and 'load'.

- Document `.onModelChange`?

- Improve documentation by better-describing what is meant (and an example where the feature is useful) in the README.md's "Naming" section where it is written:

		Notice that the collections in the complex example above are referenced at the `<li>` level,
		but it is nice to push the actual object out of the template up to the "model" attribute of
		the enclosing `<ul>` so that there is a view and model for the list as a whole as well.

- Add modifying punctuation to allow concise ways of dealing with the
			motivating templating output patterns listed ****below****.  Consider
			using .{next,previous}Sibling to implement.

- Auto-quote values to prevent XSS

- Consider bash-like operators to support conditional output if an
			object is null or empty-string?:

 >			X:-Y	=> (X !== null || X === '' ? X  : Y)
 >			X+Y		=> (X === null || X !== ''  ? '' : Y)

