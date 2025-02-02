const testCases = [
    {
        'name': 'css-animation2',
        'url': 'https://smartbear.github.io/visual-testing-example-website/sdk-testcases/css-animation2/index.html',
        'options': {
            'freezePage': true
        },
        'validation': {
            'freezePageResult': {
                'totalFrozen': {
                    'gifs': 0,
                    'bgGifs': 0,
                    'animations': 1,
                    'videos': 0
                }
            }
        }
    },
    // {
    //     'name': 'css-animation3',
    //     'url': 'https://smartbear.github.io/visual-testing-example-website/sdk-testcases/css-animation3/index.html',
    //     'options': {
    //         'freezePage': true
    //     },
    //     'validation': {
    //         'freezePageResult': {
    //             'totalFrozen': {
    //                 'gifs': 0,
    //                 'bgGifs': 0,
    //                 'animations': 4,
    //                 'videos': 0
    //             }
    //         }
    //     }
    // },
    // {
    //     'name': 'css-animation4',
    //     'url': 'https://smartbear.github.io/visual-testing-example-website/sdk-testcases/css-animation4/index.html',
    //     'options': {
    //         'freezePage': true
    //     },
    //     'validation': {
    //         'freezePageResult': {
    //             'totalFrozen': {
    //                 'gifs': 0,
    //                 'bgGifs': 0,
    //                 'animations': 6,
    //                 'videos': 0
    //             }
    //         }
    //     }
    // },
    // {
    //     'name': 'gif-image-1',
    //     'url': 'https://smartbear.github.io/visual-testing-example-website/sdk-testcases/gif-image1/index.html',
    //     'options': {
    //         'freezePage': true
    //     },
    //     'validation': {
    //         'freezePageResult': {
    //             'totalFrozen': {
    //                 'gifs': 1,
    //                 'bgGifs': 0,
    //                 'animations': 0,
    //                 'videos': 0
    //             }
    //         }
    //     }
    // },
    // {
    //     'name': 'gif-background-image1',
    //     'url': 'https://smartbear.github.io/visual-testing-example-website/sdk-testcases/gif-background-image1/index.html',
    //     'options': {
    //         'freezePage': true
    //     },
    //     'validation': {
    //         'freezePageResult': {
    //             'totalFrozen': {
    //                 'gifs': 0,
    //                 'bgGifs': 1,
    //                 'animations': 0,
    //                 'videos': 0
    //             }
    //         }
    //     }
    // },
    //This constantly returns 2 on videos froze for me on Cypress
    //We need a better example with videos. This page is created by archiver and videos sometimes don't load
    // {
    //     'name': 'videos-autoplay',
    //     'url': 'https://smartbear.github.io/visual-testing-example-website/sdk-testcases/websites/LaunchAndGrow/index.html',
    //     'options': {
    //         'freezePage': true,
    //         // 'lazyload': 1200
    //     },
    //     'validation': {
    //         'freezePageResult': {
    //             'totalFrozen': {
    //                 'gifs': 0,
    //                 'bgGifs': 0,
    //                 'animations': 0,
    //                 'videos': 3 //it's only 3 if lazyload
    //             }
    //         }
    //     }
    // },
]

const getDescribeTitle = require('../../../utils/getDescribeTitle')

Cypress.on('uncaught:exception', () => {
    // returning false here prevents Cypress from
    // failing the test
    return false
})

const insertCustomFreezeScript = true;

testCases.forEach(currentTestCase => {
    let dataFromTest;
    describe(getDescribeTitle(Cypress.spec.name, currentTestCase), () => {
        it(`should take sbvtCapture`, () => {
            cy.visit(currentTestCase.url).then(() => {
                
                cy.wait(1500);
                cy.window()
                    .then((win) => {
                        cy.readFile("./utils/exampleFreezeCarousel.js").then((str) => {
                            if (insertCustomFreezeScript) win.eval(str);
                            cy.sbvtCapture(currentTestCase.name, currentTestCase.options).then((data) => {
                                dataFromTest = data;
                            })
                        })
                    })
            })
        })
        it(`dom should have correct data`, () => {
            assert(dataFromTest.dom, 'DOM is missing');
            assert(dataFromTest.dom.error === false, 'DOM capture has an error');
            assert(dataFromTest.dom.fullpage.width && dataFromTest.dom.fullpage.height, 'DOM capture doesnt have fullpage width and height');
            assert(dataFromTest.dom.viewport.width && dataFromTest.dom.viewport.height, 'DOM capture doesnt have viewport width and height');
            assert(dataFromTest.dom.devicePixelRatio >= 1, 'DOM capture invalid devicePixelRatio');
            assert(dataFromTest.dom.dom.length >= 1, 'DOM elements missing');
        })
        if (currentTestCase.validation && currentTestCase.validation.freezePageResult) {
            it(`dom should prove freezePage is working`, () => {
                assert(dataFromTest.screenshotResult.freezePageResult, 'Missing freezePageResult in screenshotResult');
                assert.deepStrictEqual(dataFromTest.screenshotResult.freezePageResult, currentTestCase.validation.freezePageResult, `dataFromTest freezePageResult did not match currentTestCase validation`);
            })
        }
    })
})


