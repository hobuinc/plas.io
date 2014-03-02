// ui.js
// All UI stuff goes here
//

(function(scope) {
	"use strict";

	// Start UI
	$(function() {
		var layout = $("body").layout({
			applyDefaultStyles: true,
			east: {
				resizable: true,
				resize: true,
				togglerContent_open:   "&#8250;",
				togglerContent_closed: "&#8249;",
				minSize: 200,
				maxSize: 600,
				size: 400
			},

			onresize: function() {
				doRenderResize();
			}});


		setupFileOpenHandlers();
		setupSliders();
		setupComboBoxActions();
	});

	var progress = function(percent, msg) {
		$("#loaderProgress").show();
		if (msg)
			$("#loaderProgress p").html(msg);

		$("#loaderProgress .progress-bar")
			.attr("aria-valuenow", percent)
			.css("width", percent + "%");
	};

	var numberWithCommas = function(x) {
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	};

	var setupFileOpenHandlers = function() {
		$("#loaderProgress").hide();

		$(document).on('change', '.btn-file :file', function(e) {
			var input = $(this);
			var file = input.get(0).files[0];

			e.preventDefault();

			progress(0, "Fetching " + file.name + "...");
			var fr = new FileReader();
			fr.onprogress = function(e) {
				console.log('progress', arguments);
				progress(Math.round(e.loaded * 100 / e.total));
			};
			fr.onload = function(e) {
				var d = e.target.result;
				var lf = new LASFile(d);

				progress(0, 'Decoding ' + file.name + '...');

				console.log('Compressed?', lf.isCompressed);
				lf.open().then(function() {
					return lf.getHeader();
				}).then(function(header) {
					console.log('Got', header);

					var batcher = new ParticleSystemBatcher(
						$("#vertexshader").text(),
						$("#fragmentshader").text());

					var skip = Math.round((10 - currentLoadFidelity()));
					console.log("Skip value:", skip);
					var totalRead = 0;
					var totalToRead = (skip <= 1 ? header.pointsCount : header.pointsCount / skip);
					var reader = function() {
						return lf.readData(1000000, 0, skip).then(function(data) {
							batcher.push(new LASDecoder(data.buffer,
														header.pointsFormatId,
														header.pointsStructSize,
														data.count,
														header.scale,
														header.offset));

							totalRead += data.count;
							progress(Math.round(100 * totalRead / totalToRead));

							console.log('Got data', data.count);
							if (data.hasMoreData)
								return reader();
							else {
								loadBatcher(batcher);
								header.totalRead = totalRead;
								return header;
							}
						});
					};
					return reader();
				}).then(function(header) {
					$("#loaderProgress").hide();
					$(".props").html(
						"<tr><td>Name</td><td>" + file.name + "</td></tr>" +
						"<tr><td>File Version</td><td>" + lf.versionAsString + "</td></tr>" +
						"<tr><td>Compressed?</td><td>" + (lf.isCompressed ? "Yes" : "No") + "</td></tr>" +
						"<tr><td>Total Points</td><td>" + numberWithCommas(header.pointsCount) + " (" +
						numberWithCommas(header.totalRead) + ") " + "</td></tr>" +
						"<tr><td>Point Format ID</td><td>" + header.pointsFormatId + "</td></tr>" +
						"<tr><td>Point Record Size</td><td>" + header.pointsStructSize + "</td></tr>");

					// finally close the file
					return lf.close();
				}).then(function() {
					console.log("Done");
				});
			};
			fr.readAsArrayBuffer(file);
		});
	};

	var setupSliders = function() {
		$("#loadFidelity").noUiSlider({
			range: [1, 9],
			start: 5,
			handles: 1,
			connect: "lower",
			step: 1
		});

		$("#fov").noUiSlider({
			range: [10, 110],
			start: 60,
			handles: 1,
			connect: "lower"
		});

		$("#intensity").noUiSlider({
			range: [0, 255],
			start: [20, 150],
			connect: true,
			slide: function() {
				$.event.trigger({
					type: 'plasio.intensityClampChanged'
				});
			}
		});

		$("#blending").noUiSlider({
			range: [0, 100],
			start: 50,
			handles: 1,
			slide: function() {
				$.event.trigger({
					type: 'plasio.intensityBlendChanged'
				});
			}
		});

		scope.currentLoadFidelity = function() {
			return $("#loadFidelity").val();
		};
		scope.currentIntensityClamp = function() {
			return $("#intensity").val();
		};

		scope.currentIntensityBlend = function() {
			return $("#blending").val();
		};
	};

	var setupComboBoxActions = function() {
		$("#colorsource").on("click", "a", function(e) {
			e.preventDefault();
			var $a = $(this);
			console.log($a);

			var option = $a.text();
			var target = $a.attr("href").substring(1);
			$("#colorsource").find("button")
				.html(option + "&nbsp;<span class='caret'></span>")
				.attr("target", target);

			$.event.trigger({
				type: "plasio.colorsourceChanged"
			});
		});

		$("#intensitysource").on("click", "a", function(e) {
			e.preventDefault();
			var $a = $(this);
			console.log($a);

			var option = $a.text();
			var target = $a.attr("href").substring(1);
			$("#intensitysource").find("button")
				.html(option + "&nbsp;<span class='caret'></span>")
				.attr("target", target);

			$.event.trigger({
				type: "plasio.intensitysourceChanged"
			});
		});


		$("#colormap").on("click", "a", function(e) {
			e.preventDefault();
			var $a = $(this);

			var $img = $a.find("img");
			var imageUrl = $img.attr("src");

			var $target = $("#colormap").find("button img");
			$target.attr("src", imageUrl);

			$.event.trigger({
				type: "plasio.colormapChanged"
			});
		});

		scope.currentColorSource = function() {
			console.log($("#colorsource button"));
			var source = $("#colorsource button").attr('target');
			console.log("Source is:", source);
			return source;
		};

		scope.currentIntensitySource = function() {
			console.log($("#intensitysource button"));
			var source = $("#intensitysource button").attr('target');
			console.log("Source is:", source);
			return source;
		};

		scope.currentColorMap = function() {
			var $target = $("#colormap").find("button img");
			return $target.attr("src");
		};
	};


})(window);
