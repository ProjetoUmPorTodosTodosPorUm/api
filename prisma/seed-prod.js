const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const production = async () => {
    // Check if it was created before
    const alreadyCreated = await prisma.field.findUnique({
        where: {
            id: '00000000-0000-0000-0000-000000000000',
        }
    })

    if (!!alreadyCreated) {
        console.log('Fictitious datafictitious data already is in DB. Skipping.')
        return
    }

    // Fields
    await prisma.field.create({
        data: {
            id: '00000000-0000-0000-0000-000000000000',
            continent: 'América',
            country: 'Brasil',
            state: 'Rio de Janeiro',
            designation: 'Unidade e União',
            abbreviation: 'AMEBRRJ01 (demonstração)',
            mapArea: [],
            mapLocation: {}
        }
    })
    const fieldId = (await prisma.field.findMany())[0].id;
    console.log('Finished Fields.')

    // Welcomed Families
    await prisma.welcomedFamily.createMany({
        data: [
            {
                representative: 'Vinicius Renato Caldeira',
                familyName: 'Caldeira',
                fieldId,
            },
            {
                representative: 'Enrico Pietro Henrique Costa',
                familyName: 'Costa',
                fieldId,
            },
            {
                representative: 'Malu Márcia Fabiana Castro',
                familyName: 'Castro',
                fieldId,
            },
            {
                representative: 'Theo Felipe Ryan de Paula',
                familyName: 'De Paula',
                fieldId,
            },
            {
                representative: 'Amanda Camila Louise Duarte',
                familyName: 'Duarte',
                fieldId,
            },
            {
                representative: 'Elisa Marlene da Silva',
                familyName: 'Silva',
                fieldId,
            }
        ]
    })
    console.log('Finished Welcomed Families.')

    // Offeror Families
    await prisma.offerorFamily.createMany({
        data: [
            {
                representative: 'Benício Theo Almada',
                familyName: 'Almada',
                commitment: '1kg de arroz',
                group: 'CHURCH',
                churchDenomination: 'Assembleia de Deus',
                fieldId,
            },
            {
                representative: 'Nina Josefa Simone Barbosa',
                familyName: 'Barbosa',
                commitment: '1l de leite',
                churchDenomination: 'Igreja Presbiteriana',
                group: 'CHURCH',
                fieldId,
            },
            {
                representative: 'Lara Josefa Silveira',
                familyName: 'Silveira',
                commitment: '1kg de sal',
                group: 'CHURCH',
                churchDenomination: 'Assembleia de Deus',
                fieldId,
            },
            {
                representative: 'Renan Cauã de Paula',
                familyName: 'De Paula',
                commitment: 'Papel higiênico',
                group: 'CHURCH',
                churchDenomination: 'Igreja Presbiteriana',
                fieldId,
            },
            {
                representative: 'Elias Edson Lopes',
                familyName: 'Lopes',
                commitment: '1kg de macarrão',
                group: 'CHURCH',
                churchDenomination: 'Igreja Batista',
                fieldId,
            },
            {
                representative: 'Alana Cristiane Luiza da Mata',
                familyName: 'Da mata',
                commitment: '1kg de feijão',
                group: 'CHURCH',
                churchDenomination: 'Assembleia de Deus',
                fieldId,
            },
            {
                representative: 'Aurora Bruna Teixeira',
                familyName: 'Teixeira',
                commitment: '500g de café',
                group: 'CHURCH',
                churchDenomination: 'Igreja Batista',
                fieldId,
            },
            {
                representative: 'Mariah Andrea Tereza Sousa',
                familyName: 'Souza',
                commitment: '1l de óleo',
                group: 'CHURCH',
                churchDenomination: 'Assembleia de Deus',
                fieldId,
            },
            {
                representative: 'Carla Sophie Milena Galvão',
                familyName: 'Galvão',
                commitment: '1kg de farinha',
                group: 'CHURCH',
                churchDenomination: 'Deus é amor',
                fieldId,
            },
            {
                representative: 'Luiza Sophie Stephany Assunção',
                familyName: 'Assunção',
                commitment: '1l de óleo',
                group: 'CHURCH',
                churchDenomination: 'Igreja Presbiteriana',
                fieldId,
            },
            {
                representative: 'Pedro Henrique Raimundo Freitas',
                familyName: 'Assunção',
                commitment: '1kg de açúcar',
                group: 'COMMUNITY',
                fieldId,
            },
            {
                representative: 'Ayla Vitória Giovanna Santos',
                familyName: 'Santos',
                commitment: '1kg de arroz',
                group: 'COMMUNITY',
                fieldId,
            },
            {
                representative: 'Bryan Vicent Caleb Aragão',
                familyName: 'Aragão',
                commitment: '2cx creme dental',
                group: 'COMMUNITY',
                fieldId,
            },
            {
                representative: 'Geraldo Thales Luiz Moreira',
                familyName: 'Moreira',
                commitment: '3 sabonetes',
                group: 'COMMUNITY',
                fieldId,
            },
            {
                representative: 'Letícia Kamilly Olivia da Cruz',
                familyName: 'Cruz',
                commitment: '2 desodorantes',
                group: 'EXTERNAL',
                fieldId,
            },
        ]
    })
    console.log('Finished Offeror Families.')

    // Churches in Unity
    await prisma.church.createMany({
        data: [
            {
                name: 'Assembleia de Deus',
                description: '<p><strong>A Assembleia de Deus</strong> tem desempenhado um papel fundamental no projeto "Um por todos! Todos por um", promovendo a uni&atilde;o e o trabalho espiritual em prol da comunidade. Neste artigo, vamos explorar como a igreja tem contribu&iacute;do para a realiza&ccedil;&atilde;o deste importante projeto.<br /><br />Uni&atilde;o em torno de um prop&oacute;sito comum<br /><br />A Assembleia de Deus tem sido um exemplo de unidade, reunindo seus membros em torno do prop&oacute;sito de servir ao pr&oacute;ximo. Atrav&eacute;s do projeto "Um por todos! Todos por um", a igreja tem fortalecido os la&ccedil;os entre os fi&eacute;is, promovendo a solidariedade e o amor ao pr&oacute;ximo.<br /><br /><strong>Trabalho espiritual em a&ccedil;&atilde;o</strong><br /><br />O trabalho espiritual realizado pela Assembleia de Deus no &acirc;mbito do projeto tem sido inspirador. Os membros da igreja t&ecirc;m se dedicado a ajudar aqueles que mais precisam, levando conforto, esperan&ccedil;a e f&eacute; a todos os que cruzam o seu caminho. O poder da ora&ccedil;&atilde;o e da palavra de Deus tem sido uma fonte de for&ccedil;a e consolo para a comunidade.<br /><br /><strong>Impacto na comunidade</strong><br /><br />O projeto "Um por todos! Todos por um" tem tido um impacto significativo na comunidade, transformando vidas e trazendo esperan&ccedil;a a muitos. Atrav&eacute;s do trabalho conjunto da Assembleia de Deus e de outros parceiros, tem sido poss&iacute;vel atender &agrave;s necessidades dos mais vulner&aacute;veis e promover o bem-estar de todos.<br /><br /><strong>Junte-se a n&oacute;s neste projeto de amor e uni&atilde;o!</strong><br /><br /></p',
                type: 'PIONEER',
                fieldId,
            },
            {
                name: 'Igreja Batista',
                description: `<p><strong>A Igreja Batista</strong> tem desempenhado um papel fundamental no projeto "um por todos! todos por um" como igreja de apoio, promovendo um trabalho espiritual que tem fortalecido n&atilde;o s&oacute; a comunidade, mas tamb&eacute;m as outras igrejas da regi&atilde;o. Atrav&eacute;s de atividades de evangeliza&ccedil;&atilde;o, assist&ecirc;ncia social e eventos de integra&ccedil;&atilde;o, a igreja tem buscado unir os fi&eacute;is em um prop&oacute;sito comum de amor ao pr&oacute;ximo e compartilhamento da palavra de Deus.</p>
                <p>Atrav&eacute;s do projeto, temos visto o fortalecimento da f&eacute; dos membros da comunidade, o aumento da solidariedade e a cria&ccedil;&atilde;o de la&ccedil;os mais profundos entre as igrejas locais. O trabalho espiritual promovido tem impactado n&atilde;o s&oacute; os participantes diretos, mas tamb&eacute;m aqueles que s&atilde;o beneficiados pelas a&ccedil;&otilde;es sociais e evangel&iacute;sticas. &Eacute; gratificante ver como a uni&atilde;o das igrejas tem gerado frutos maravilhosos na regi&atilde;o, transformando vidas e propagando a mensagem de amor e esperan&ccedil;a.</p>
                <p><strong>Venha fazer parte desse movimento de uni&atilde;o e solidariedade!</strong> Participe do projeto "um por todos! todos por um" e ajude a fortalecer a comunidade e as igrejas locais. Juntos, podemos fazer a diferen&ccedil;a e espalhar a mensagem de amor e f&eacute; por toda a regi&atilde;o. Unidos em Cristo, somos mais fortes! #juntosporum #igrejabatista #solidariedade #uni&atilde;o</p>`,
                type: 'SUPPORT',
                fieldId,
            },
            {
                name: 'Igreja Presbiteriana',
                description: `<p><strong>A Igreja Presbiteriana</strong> tem desempenhado um papel fundamental no projeto "um por todos! todos por um", atuando como uma igreja de apoio e promovendo a uni&atilde;o entre diversas denomina&ccedil;&otilde;es crist&atilde;s. Atrav&eacute;s do di&aacute;logo e da coopera&ccedil;&atilde;o, temos observado um fortalecimento nas quest&otilde;es doutrinais entre as igrejas, evidenciando a import&acirc;ncia da unidade na f&eacute; em Cristo.</p>
                <p>O testemunho pessoal de vida dos fi&eacute;is da Igrejas em Unidade tem sido um instrumento poderoso para atrair outras pessoas para os ensinamentos de Cristo. Com uma conduta &eacute;tica e centrada nos princ&iacute;pios b&iacute;blicos, os membros t&ecirc;m impactado positivamente suas comunidades e conquistado novos seguidores para Cristo.</p>
                <p>O projeto "um por todos! todos por um" representa um marco positivo na hist&oacute;ria do cristianismo no Brasil, evidenciando a import&acirc;ncia da colabora&ccedil;&atilde;o e da comunh&atilde;o entre as igrejas para a propaga&ccedil;&atilde;o do Evangelho. A Igreja Presbiteriana se alegra em fazer parte dessa iniciativa e em contribuir para a expans&atilde;o do Reino de Deus em nossa na&ccedil;&atilde;o.</p>`,
                type: 'SUPPORT',
                fieldId,
            }
        ]
    })
    console.log('Finished Churches in Unity.')

    // Volunteers
    await prisma.volunteer.createMany({
        data: [
            {
                firstName: 'Vinícius',
                lastName: 'Diego Araújo',
                joinedDate: new Date('2022-08-02'),
                occupation: 'PRESIDENT',
                church: 'Assembleia de Deus',
                fieldId,
            },
            {
                firstName: 'Isaac',
                lastName: 'Ruan Almeida',
                joinedDate: new Date('2022-08-02'),
                occupation: 'VICE_PRESIDENT',
                church: 'Assembleia de Deus',
                fieldId,
            },
            {
                firstName: 'Renato',
                lastName: 'Gabriel Leonardo de Paula',
                joinedDate: new Date('2022-08-03'),
                occupation: 'GENERAL_COORDINATOR',
                church: 'Assembleia de Deus',
                priest: 'Vinícius Diego Araújo',
                fieldId,
            },
            {
                firstName: 'Vitor',
                lastName: 'Thomas Santo',
                joinedDate: new Date('2022-08-03'),
                occupation: 'COORDINATOR_01',
                church: 'Assembleia de Deus',
                priest: 'Vinícius Diego Araújo',
                fieldId,
            },
            {
                firstName: 'Esther',
                lastName: 'Raquel Viana',
                joinedDate: new Date('2022-08-10'),
                occupation: 'TREASURER_01',
                church: 'Igreja Batista',
                fieldId,
            },
            {
                firstName: 'Lívia',
                lastName: 'Isabel Cavalcante',
                joinedDate: new Date('2022-08-03'),
                occupation: 'ACADEMIC_INSTRUCTOR_01',
                church: 'Assembleia de Deus',
                priest: 'Vinícius Diego Araújo',
                fieldId,
            },
            {
                firstName: 'Levi',
                lastName: 'Calebe Rocha',
                joinedDate: new Date('2022-08-07'),
                occupation: 'INFIELD_COORDINATOR',
                church: 'Assembleia de Deus',
                priest: 'Vinícius Diego Araújo',
                fieldId,
            },
            {
                firstName: 'Marinna',
                lastName: 'Jennifer Gonçalves',
                joinedDate: new Date('2022-08-20'),
                occupation: 'COLLECTOR',
                fieldId,
            },
            {
                firstName: 'José',
                lastName: 'Caio Campos',
                joinedDate: new Date('2022-08-03'),
                occupation: 'ACADEMIC_INSTRUCTOR_02',
                church: 'Igreja Presbiteriana',
                fieldId,
            },

            {
                firstName: 'Anthony',
                lastName: 'Miguel Cardoso',
                joinedDate: new Date('2022-09-07'),
                occupation: 'SUPPORT_SERVICE',
                church: 'Igreja Batista',
                fieldId,
            },
            {
                firstName: 'Felipe',
                lastName: 'Marcelo Diego da Cruz',
                joinedDate: new Date('2022-10-18'),
                occupation: 'SUPPORT_SERVICE',
                fieldId,
            },
        ]
    })
    console.log('Finished Volunteers.')

    // Collaborators
    await prisma.collaborator.createMany({
        data: [
            {
                title: 'Papelaria Arte & Papel',
                description: `O nosso colaborador do projeto "um por todos! todos por um" é um querido membro da nossa comunidade local. Ele é o dono da nossa loja de bairro e um devoto cristão, que encontrou no projeto uma oportunidade de unir esforços com outras igrejas e promover a solidariedade entre os vizinhos. Sua generosidade e dedicação são inspiradoras, e estamos muito gratos por tê-lo como parte desse incrível movimento de amor ao próximo. Juntos, somos um!`,
                fieldId,

            },
            {
                title: 'Multi Bairro Minimercado',
                description: `<p><strong>O Multi Bairro Minimercado</strong> &eacute; um com&eacute;rcio local que se destaca pela variedade de produtos e pela qualidade no atendimento aos seus clientes. A empresa valoriza a integra&ccedil;&atilde;o e colabora&ccedil;&atilde;o entre os bairros da regi&atilde;o em que est&aacute; inserida, visando sempre o bem-estar e a uni&atilde;o da comunidade.</p>
                <p>Foi com esses valores em mente que o Multi Bairro Minimercado decidiu colaborar com o projeto "Um por todos! Todos por um!". A empresa acredita que somente unindo esfor&ccedil;os e ajudando uns aos outros &eacute; poss&iacute;vel alcan&ccedil;ar mudan&ccedil;as positivas e construir uma sociedade mais solid&aacute;ria e justa.</p>
                <p>Por isso, o Multi Bairro Minimercado se compromete a contribuir com o projeto de diversas formas, seja realizando doa&ccedil;&otilde;es, promovendo campanhas de arrecada&ccedil;&atilde;o de alimentos ou oferecendo descontos especiais para clientes que tamb&eacute;m apoiam a iniciativa.</p>
                <p>Com essa atitude, o Multi Bairro Minimercado reafirma o seu compromisso com a comunidade e com os valores de solidariedade, colabora&ccedil;&atilde;o e inclus&atilde;o que s&atilde;o t&atilde;o importantes para o desenvolvimento de uma sociedade mais justa e igualit&aacute;ria. Um por todos e todos por um!</p>`,
                fieldId,
            }
        ]
    })
    console.log('Finished Collaborators.')

    // Collected Offers (Monthly Offers)
    const years = [2022, 2023, 2024];
    let monthlyOffersData = [];

    for (let i = 0; i < years.length; i++) {
        for (let j = 1; j <= 12; j++) {
            monthlyOffersData.push({
                month: j,
                year: years[i],
                foodQnt: Math.ceil(Math.random() * 700),
                monetaryValue: Number((Math.random() * 250).toFixed(2)),
                othersQnt: Math.ceil(Math.random() * 30),
                fieldId,
            })
        }
    }
    await prisma.monthlyOffer.createMany({
        data: monthlyOffersData
    });
    console.log('Finished Monthly Offers.')

    // Testimonials
    await prisma.testimonial.createMany({
        data: [
            {
                name: 'Marcos (fictício)',
                text: `<p>Meu nome &eacute; Marcos e fa&ccedil;o parte de uma fam&iacute;lia assistida pelo projeto "Um por todos! Todos por um". Eu nunca imaginei que poderia receber tanto amor e apoio de pessoas desconhecidas que agora considero como fam&iacute;lia.</p>
                <p>Depois de passar por tantas tristezas e dificuldades longe de Cristo, me sentia perdido e sem esperan&ccedil;a. Mas gra&ccedil;as a esse projeto e &agrave;s igrejas envolvidas, consegui me levantar novamente.</p>
                <p>Fui acolhido com tanto carinho e compaix&atilde;o que me senti amado e valorizado como nunca antes. As pessoas ao meu redor foram como anjos enviados por Deus para me ajudar a superar os desafios da vida.</p>
                <p>Hoje, minha fam&iacute;lia e eu estamos em uma situa&ccedil;&atilde;o muito melhor, gra&ccedil;as ao suporte e encorajamento que recebemos. Sou muito grato por todo o apoio que recebemos e pelo amor que nos foi dado.</p>`,
                fieldId,
            },
            {
                name: 'Maria (fictício)',
                text: `<p>Meu nome &eacute; Maria e minha fam&iacute;lia que foi assistida pelo projeto "um por todos! todos por um". Quando chegamos aqui, est&aacute;vamos desesperados, sem saber para onde ir ou o que fazer. Fomos acolhidos de bra&ccedil;os abertos por pessoas maravilhosas que nos ajudaram em todos os momentos, nos dando apoio emocional, alimenta&ccedil;&atilde;o, roupas e at&eacute; mesmo um teto para dormir.</p>
                <p>Hoje, olho para tr&aacute;s e vejo o quanto a Igreja e Cristo fizeram a diferen&ccedil;a em nossas vidas. Antes, eu n&atilde;o entendia muito sobre a f&eacute; e a import&acirc;ncia da comunidade, mas agora vejo como &eacute; essencial ter pessoas que se importam conosco e est&atilde;o dispostas a nos ajudar de cora&ccedil;&atilde;o aberto.</p>
                <p>O projeto "um por todos! todos por um" n&atilde;o apenas nos ajudou materialmente, mas tamb&eacute;m nos mostrou o amor de Cristo de uma maneira que nunca hav&iacute;amos experimentado antes. Agrade&ccedil;o a cada pessoa envolvida nesse projeto por terem sido instrumentos de Deus em nossas vidas e por nos ensinarem a import&acirc;ncia do amor ao pr&oacute;ximo e da solidariedade. Cristo agora t&ecirc;m um significado completamente novo para mim, e sou eternamente grata por tudo que fizeram por n&oacute;s.</p>`,
                fieldId,
            }
        ]
    })
    console.log('Finished Testimonials.')

    // Announcements
    await prisma.announcement.create({
        data: {
            title: 'Vídeos Palestra Sobre o Projeto',
            message: `<p>Venham conhecer o NOVO sistema de Evangeliza&ccedil;&atilde;o Acrescido de A&ccedil;&atilde;o Social; o Projeto &ldquo;Um por todos! Todos por um&rdquo;.</p>
            <p>S&atilde;o 12 v&iacute;deos palestra que prop&otilde;e divulgar e orientar sobre seu manuseio. Voc&ecirc; sabe quem s&atilde;o as PIONEIRAS, as Expansionista, e as Distritais?</p>
            <p><a href="https://www.youtube.com/watch?v=U45N9HRnzzA&amp;list=PLaLszpCW39WOCGGp5NKGgWk3SpOi1wy81" target="_blank">Canal WMCIA &ndash; You Tube</a> / N&atilde;o perca! Nos vemos l&aacute;.</p>
            <p>A autora.</p>`,
            fixed: true,
        }
    })
    console.log('Finished Announcements')
}

module.exports = { production }